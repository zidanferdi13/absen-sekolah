# Migration workflow

Folder `migrations/` **belum ada** karena migrasi harus dibuat di mesin yang punya
aplikasi Prisma terinstall dan database berjalan.

## Membuat migrasi pertama

```bash
cd be
docker compose -f ../docker-compose.yml up -d
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run seed
```

Perintah `migrate dev --name init` akan membuat:

```
be/prisma/migrations/
├── 20260101000000_init/
│   └── migration.sql
└── migration_lock.toml
```

Commit kedua path tersebut. Setelah itu CI (`npx prisma migrate deploy`) dan
container produksi bisa membuat skema dari nol.

## Mengubah skema

1. Edit `prisma/schema.prisma`.
2. `npx prisma migrate dev --name <deskripsi_singkat>`.
3. Commit folder migrasi baru.

Jangan pernah mengedit migrasi yang sudah ada di `main` — buat migrasi baru.

## Produksi

`npx prisma migrate deploy` dijalankan otomatis oleh `CMD` di `be/Dockerfile`.
Tidak ada `migrate dev` di produksi karena perintah itu bisa menghapus data.
