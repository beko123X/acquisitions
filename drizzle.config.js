import 'dotenv/config';
import {defineConfig} from 'drizzle-kit';
export default ({
  schema: './src/models/*.js',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  }

});