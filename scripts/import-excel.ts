import { and, eq } from 'drizzle-orm';
import xlsx from 'xlsx';
import { closeDb, db } from '../src/db/client.js';
import { merchantServices, merchants, serviceCategories } from '../src/db/schema.js';
import type { MerchantImportRow, ServiceImportRow } from '../src/modules/import/excel-import.types.js';

const inputPath = process.argv[2];

if (!inputPath) {
  console.error('Usage: npm run import:excel -- <path-to-xlsx>');
  process.exit(1);
}

const workbook = xlsx.readFile(inputPath);
const merchantRows = readSheet<MerchantImportRow>(workbook, '商户');
const serviceRows = readSheet<ServiceImportRow>(workbook, '服务项目');

const categoryByName = await loadCategoryMap();
const merchantIdByKey = new Map<string, string>();
let importedMerchants = 0;
let importedServices = 0;
let skippedServices = 0;

for (const row of merchantRows) {
  const name = normalizeText(row.商户名称);
  const phone = normalizeText(row.手机号);

  if (!name || !phone) {
    continue;
  }

  const category = categoryByName.get(normalizeText(row.服务大类));
  const provinceCityDistrict = splitRegion(normalizeText(row.省市区));
  const longitude = parseDecimal(row.经度);
  const latitude = parseDecimal(row.纬度);
  const serviceRadiusKm = parseDecimal(row.服务半径km) || '3';

  const [merchant] = await db
    .insert(merchants)
    .values({
      name,
      contactName: normalizeText(row.联系人) || null,
      phone,
      wechatId: normalizeText(row.微信号) || null,
      primaryCategoryId: category?.id,
      tags: splitList(row.服务标签),
      province: provinceCityDistrict.province,
      city: provinceCityDistrict.city,
      district: provinceCityDistrict.district,
      address: normalizeText(row.详细地址) || null,
      longitude,
      latitude,
      serviceRadiusKm,
      businessHours: normalizeText(row.营业时间) || null,
      nightService: parseYesNo(row.是否夜间服务),
      verified: parseYesNo(row.是否认证),
      rating: parseDecimal(row.评分),
      note: normalizeText(row.备注) || null,
      source: 'excel',
    })
    .onConflictDoUpdate({
      target: [merchants.name, merchants.phone],
      set: {
        contactName: normalizeText(row.联系人) || null,
        wechatId: normalizeText(row.微信号) || null,
        primaryCategoryId: category?.id,
        tags: splitList(row.服务标签),
        province: provinceCityDistrict.province,
        city: provinceCityDistrict.city,
        district: provinceCityDistrict.district,
        address: normalizeText(row.详细地址) || null,
        longitude,
        latitude,
        serviceRadiusKm,
        businessHours: normalizeText(row.营业时间) || null,
        nightService: parseYesNo(row.是否夜间服务),
        verified: parseYesNo(row.是否认证),
        rating: parseDecimal(row.评分),
        note: normalizeText(row.备注) || null,
        updatedAt: new Date(),
      },
    })
    .returning({ id: merchants.id });

  merchantIdByKey.set(makeMerchantKey(name, phone), merchant.id);
  importedMerchants += 1;
}

for (const row of serviceRows) {
  const merchantName = normalizeText(row.商户名称);
  const merchantPhone = normalizeText(row.商户手机号) || normalizeText(row.手机号);
  const serviceName = normalizeText(row.服务小类);

  if (!merchantName || !serviceName) {
    skippedServices += 1;
    continue;
  }

  const merchantId = merchantPhone
    ? merchantIdByKey.get(makeMerchantKey(merchantName, merchantPhone)) || (await findMerchantId(merchantName, merchantPhone))
    : await findUniqueMerchantIdByName(merchantName);

  if (!merchantId) {
    skippedServices += 1;
    console.warn(`Skipped service without merchant: ${merchantName} / ${merchantPhone} / ${serviceName}`);
    continue;
  }

  const category = categoryByName.get(normalizeText(row.服务大类));

  await db
    .insert(merchantServices)
    .values({
      merchantId,
      categoryId: category?.id,
      name: serviceName,
      commonPhrases: splitList(row.用户常见说法),
      priceType: mapPriceType(row.价格类型),
      minPrice: parseInteger(row.最低价),
      maxPrice: parseInteger(row.最高价),
      priceDescription: normalizeText(row.价格说明) || null,
      emergencyAvailable: parseYesNo(row.是否可紧急上门),
      averageResponseTime: normalizeText(row.平均响应时间) || null,
      description: normalizeText(row.服务说明) || null,
    })
    .onConflictDoUpdate({
      target: [merchantServices.merchantId, merchantServices.name],
      set: {
        categoryId: category?.id,
        commonPhrases: splitList(row.用户常见说法),
        priceType: mapPriceType(row.价格类型),
        minPrice: parseInteger(row.最低价),
        maxPrice: parseInteger(row.最高价),
        priceDescription: normalizeText(row.价格说明) || null,
        emergencyAvailable: parseYesNo(row.是否可紧急上门),
        averageResponseTime: normalizeText(row.平均响应时间) || null,
        description: normalizeText(row.服务说明) || null,
        updatedAt: new Date(),
      },
    });

  importedServices += 1;
}

console.log(
  JSON.stringify(
    {
      importedMerchants,
      importedServices,
      skippedServices,
    },
    null,
    2,
  ),
);

await closeDb();

function readSheet<T>(workbook: xlsx.WorkBook, sheetName: string): T[] {
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    throw new Error(`Missing sheet: ${sheetName}`);
  }

  return xlsx.utils.sheet_to_json<T>(sheet, {
    defval: '',
  });
}

async function loadCategoryMap() {
  const rows = await db.select().from(serviceCategories);
  const map = new Map<string, { id: string; code: string; name: string }>();

  for (const row of rows) {
    map.set(row.name, {
      id: row.id,
      code: row.code,
      name: row.name,
    });
  }

  return map;
}

async function findMerchantId(name: string, phone: string) {
  const [row] = await db
    .select({ id: merchants.id })
    .from(merchants)
    .where(and(eq(merchants.name, name), eq(merchants.phone, phone)))
    .limit(1);

  return row?.id;
}

async function findUniqueMerchantIdByName(name: string) {
  const rows = await db
    .select({ id: merchants.id })
    .from(merchants)
    .where(eq(merchants.name, name))
    .limit(2);

  return rows.length === 1 ? rows[0].id : undefined;
}

function makeMerchantKey(name: string, phone: string) {
  return `${name}::${phone}`;
}

function normalizeText(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

function splitList(value: unknown) {
  return normalizeText(value)
    .split(/[,，、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseYesNo(value: unknown) {
  const text = normalizeText(value);

  return text === '是' || text.toLowerCase() === 'true' || text === '1';
}

function parseDecimal(value: unknown) {
  const text = normalizeText(value);

  if (!text) {
    return null;
  }

  const parsed = Number(text);

  return Number.isFinite(parsed) ? String(parsed) : null;
}

function parseInteger(value: unknown) {
  const text = normalizeText(value);

  if (!text) {
    return null;
  }

  const parsed = Number(text);

  return Number.isInteger(parsed) ? parsed : null;
}

function mapPriceType(value: unknown): 'starting' | 'range' | 'negotiable' | 'hourly' {
  const text = normalizeText(value);

  if (text === '起步价') {
    return 'starting';
  }

  if (text === '区间') {
    return 'range';
  }

  if (text === '按小时') {
    return 'hourly';
  }

  return 'negotiable';
}

function splitRegion(value: string) {
  if (!value) {
    return {
      province: null,
      city: null,
      district: null,
    };
  }

  const provinceMatch = value.match(/^(.+?(?:省|自治区|特别行政区|市))/);
  const province = provinceMatch ? provinceMatch[1] : null;
  const afterProvince = province ? value.slice(province.length) : value;
  const municipality = province && ['北京市', '上海市', '天津市', '重庆市'].includes(province);
  const cityMatch = municipality ? null : afterProvince.match(/^(.+?市)/);
  const city = municipality ? province : cityMatch ? cityMatch[1] : null;
  const afterCity = cityMatch ? afterProvince.slice(cityMatch[1].length) : afterProvince;
  const districtMatch = afterCity.match(/^(.+?(?:区|县|市))/);

  return {
    province,
    city,
    district: districtMatch ? districtMatch[1] : null,
  };
}
