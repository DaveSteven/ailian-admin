import { count } from 'drizzle-orm';
import { closeDb, db } from '../src/db/client.js';
import { merchantServices, merchants, serviceCategories } from '../src/db/schema.js';

const [categoryCount] = await db.select({ value: count() }).from(serviceCategories);
const [merchantCount] = await db.select({ value: count() }).from(merchants);
const [serviceCount] = await db.select({ value: count() }).from(merchantServices);

console.log(
  JSON.stringify(
    {
      serviceCategories: categoryCount.value,
      merchants: merchantCount.value,
      merchantServices: serviceCount.value,
    },
    null,
    2,
  ),
);

await closeDb();
