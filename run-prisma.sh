#!/bin/bash
cd /workspace
DATABASE_URL="postgresql://neondb_owner:npg_1QUlscp0eSLo@ep-fancy-violet-awgw1e4g-pooler.c-12.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require" ./node_modules/.bin/prisma db push --skip-generate
