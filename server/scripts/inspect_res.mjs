import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import Reservation from '../models/Reservation.js';

await mongoose.connect(process.env.MONGODB_URI);

const res = await Reservation.findById('6a11eef185a8ce84195012c8').lean();
console.log('Reservation 6a11eef185a8ce84195012c8:', JSON.stringify(res, null, 2));

await mongoose.disconnect();
