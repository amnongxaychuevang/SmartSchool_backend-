# EduSmart UAT: ຄູ່ມື deploy

Stack ນີ້ແຍກອອກຈາກລະບົບອື່ນໃນ server ທັງໝົດ: MySQL, container, network ແລະ port ເປັນຂອງຕົວເອງ.
ເປີດ port ໃຫ້ເຂົ້າໄດ້ສະເພາະ `127.0.0.1`. ຄົນພາຍນອກເຂົ້າຜ່ານ nginx ຂອງ server ເທົ່ານັ້ນ.

| Container | ໜ້າທີ່ | Port ໃນ server |
|---|---|---|
| `edusmart-uat-db` | MySQL 8.4 | ບໍ່ເປີດ |
| `edusmart-uat-api` | Backend | `127.0.0.1:5100` |
| `edusmart-uat-web` | Frontend | `127.0.0.1:3100` |

ທົດສອບແລ້ວໃນເຄື່ອງ dev ດ້ວຍ Docker: build ຜ່ານ, ສ້າງ schema ແລະ seed ໄດ້, login ແລະ dashboard ເຮັດວຽກ,
socket.io ເຊື່ອມຕໍ່ໄດ້, ແລະ backup ອັດຕະໂນມັດສ້າງໄຟລ໌ໃນ `data/backups`.

---

## ກ່ອນເລີ່ມ: ກວດ server

```bash
free -h                      # RAM: stack ນີ້ໃຊ້ປະມານ 1 ຫາ 1.5 GB
docker compose version       # ຕ້ອງເປັນ v2
sudo ss -ltnp | grep -E ':(5100|3100)\b' || echo "ports free"
```

ຖ້າ port 5100 ຫຼື 3100 ຖືກໃຊ້ແລ້ວ ໃຫ້ປ່ຽນ `API_PORT` ຫຼື `WEB_PORT` ໃນ `.env` ແລະ ໃນ nginx config ໃຫ້ກົງກັນ.

## 1. DNS

ໃນ Cloudflare ເພີ່ມ **A record**: `edusmart` → `141.98.17.187`.

- ໃນຕອນທຳອິດ ໃຫ້ຕັ້ງ Proxy ເປັນ **DNS only** (ເມກສີເທົາ) ເພື່ອໃຫ້ certbot ອອກ cert ໃນຂັ້ນ 6 ໄດ້ງ່າຍ.
- ກວດດ້ວຍ `dig +short edusmart.phousam.com`. ຕ້ອງໄດ້ `141.98.17.187`.

## 2. ເອົາໂຄດຂຶ້ນ server

```bash
mkdir -p ~/edusmart-uat && cd ~/edusmart-uat
git clone -b feature/dashboard-needs-attention <backend-repo-url>  backend
git clone -b feature/dashboard-needs-attention <frontend-repo-url> frontend
```

ສອງ folder ຕ້ອງຢູ່ຄູ່ກັນຊື່ `backend` ແລະ `frontend`, ເພາະ compose build ຈາກ `../../../frontend`.

## 3. ຕັ້ງຄ່າ `.env`

```bash
cd ~/edusmart-uat/backend/deploy/uat
cp .env.uat.example .env
openssl rand -hex 32   # run ຫຼາຍຄັ້ງ: ເອົາໄປໃສ່ DB_ROOT_PASSWORD, DB_PASSWORD, JWT_SECRET, DEVICE_API_KEY
nano .env
chmod 600 .env
```

- ລະຫັດ DB ຕ້ອງເປັນ hex (ຕົວອັກສອນ a-f ແລະ ຕົວເລກ) ເພາະຖືກໃສ່ໃນ URL ຂອງ database.
- ຖ້າ `JWT_SECRET` ສັ້ນກວ່າ 32 ຕົວ ຫຼື ເປັນຄ່າຕົວຢ່າງ, API ຈະບໍ່ຍອມ start.

## 4. Folder ເກັບຂໍ້ມູນ

ຮູບ, ເອກະສານ ແລະ backup ເກັບໃນ `data/` ຂອງ server, ຈຶ່ງບໍ່ຫາຍເມື່ອ deploy ໃໝ່.
Container run ເປັນ user `node` (uid 1000), ສະນັ້ນຕ້ອງໃຫ້ສິດຂຽນ:

```bash
mkdir -p data/uploads data/storage/private data/backups
sudo chown -R 1000:1000 data
```

## 5. Build ແລະ ສ້າງ database

```bash
docker compose build                     # ຄັ້ງທຳອິດໃຊ້ເວລາຫຼາຍນາທີ
docker compose up -d db                  # ລໍໃຫ້ status ເປັນ healthy: docker compose ps
docker compose run --rm api npx prisma migrate deploy   # ສ້າງຕາຕະລາງຈາກ prisma/migrations
docker compose run --rm api npx prisma db seed          # ສ້າງ roles ແລະ admin ຈາກ SEED_ADMIN_* ໃນ .env
docker compose up -d
docker compose ps                        # ທັງ 3 container ຕ້ອງ Up
```

- ຖ້າບໍ່ໄດ້ຕັ້ງ `SEED_ADMIN_EMAIL` ແລະ `SEED_ADMIN_PASSWORD` ໃນ `.env`, seed ຈະບໍ່ຍອມ run.
- ລະຫັດຕ້ອງຍາວຢ່າງໜ້ອຍ 12 ຕົວອັກສອນ.

**ຫ້າມ** run `db:seed-demo` ຖ້າຈະໃຫ້ຄົນນອກມາທົດສອບດ້ວຍຂໍ້ມູນທີ່ຄ້າຍຂອງແທ້.

## 6. nginx ແລະ SSL

ກ່ອນ reload ຕ້ອງ run `nginx -t` ທຸກຄັ້ງ. ຖ້າ config ຜິດ, ລະບົບອື່ນທີ່ໃຊ້ nginx ດຽວກັນຈະລົ້ມນຳ.

```bash
sudo cp nginx-edusmart-uat.conf /etc/nginx/sites-available/edusmart-uat
sudo ln -s /etc/nginx/sites-available/edusmart-uat /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d edusmart.phousam.com
```

ແນະນຳໃຫ້ record ຂອງ UAT ເປັນ **DNS only** (ເມກສີເທົາ) ຕະຫຼອດ.

- Server ນີ້ບໍ່ມີ port 443. ສະແດງວ່າ phousam.com ໃຊ້ Cloudflare SSL mode **Flexible**.
- ຖ້າເປີດ Proxy ໃຫ້ subdomain ນີ້ໃນຂະນະທີ່ mode ຍັງເປັນ Flexible, browser ຈະ redirect ວົນບໍ່ຢຸດ.
- ຖ້າຢາກເປີດ Proxy ແທ້ໆ ໃຫ້ສ້າງ Configuration Rule ສະເພາະ `edusmart.phousam.com` ເພື່ອຕັ້ງ SSL ເປັນ **Full (strict)**. ຫ້າມປ່ຽນ mode ຂອງທັງ zone ເພາະຈະກະທົບ phousam.com.
- ຈາກນັ້ນໃສ່ `TRUST_PROXY=2` ໃນ `.env` ແລ້ວ run `docker compose up -d`. ຄ່າເລີ່ມຕົ້ນແມ່ນ `1`, ເຊິ່ງໝາຍເຖິງມີແຕ່ nginx ຢູ່ຂ້າງໜ້າ API.

## 7. ກວດຫຼັງ deploy

```bash
curl -I https://edusmart.phousam.com/                  # 200
curl -s -X POST https://edusmart.phousam.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phoneOrEmail":"x","password":"x"}' -o /dev/null -w '%{http_code}\n'   # 401 = API ເຮັດວຽກ
```

ຈາກນັ້ນເປີດໃນ browser ແລ້ວ login ດ້ວຍ `SEED_ADMIN_EMAIL` ແລະ `SEED_ADMIN_PASSWORD`.

---

## ອັບເດດເວີຊັນໃໝ່

```bash
cd ~/edusmart-uat/backend  && git pull
cd ~/edusmart-uat/frontend && git pull
cd ~/edusmart-uat/backend/deploy/uat
docker exec edusmart-uat-api node scripts/db-backup.js           # backup ກ່ອນປ່ຽນ schema
docker compose build
docker compose run --rm api npx prisma migrate deploy            # run ສະເພາະ migration ໃໝ່
docker compose up -d
```

- `migrate deploy` run ສະເພາະໄຟລ໌ໃນ `prisma/migrations` ທີ່ຍັງບໍ່ເຄີຍ run, ແລະ ບໍ່ເຄີຍລຶບຂໍ້ມູນເອງ.
- **ຫ້າມໃຊ້ `prisma db push`** ກັບ server ນີ້.

**Database ທີ່ສ້າງດ້ວຍ `db push` ກ່ອນມີ migrations** (ເຊັ່ນ UAT ທີ່ deploy ວັນທີ 2026-11-10) ຕ້ອງບອກ Prisma ວ່າ baseline ຖືກ run ແລ້ວ. ເຮັດເທື່ອດຽວກ່ອນ `migrate deploy` ຄັ້ງທຳອິດ:

```bash
docker compose run --rm api npx prisma migrate resolve --applied 0_init
```

ສ້າງ migration ໃໝ່ໃນເຄື່ອງ dev ຫຼັງແກ້ `schema.prisma`: `npm run db:migrate:new -- --name <ຊື່>`. ອ່ານໄຟລ໌ SQL ທີ່ໄດ້ກ່ອນ commit.

## ເບິ່ງ log ແລະ backup

```bash
docker compose logs -f api
docker compose logs -f web
ls -lh data/backups/                                   # backup ອັດຕະໂນມັດທຸກຄືນ ເວລາ 02:00
docker exec edusmart-uat-api node scripts/db-backup.js # backup ດ້ວຍມື
```

ແຕ່ລະຄັ້ງໄດ້ 2 ໄຟລ໌:

| ໄຟລ໌ | ເນື້ອໃນ |
|---|---|
| `smart_school_*.sql.gz` | database |
| `files_*.tar.gz` | ຮູບ ແລະ ເອກະສານ (`uploads/` ແລະ `storage/`) |

ລະບົບເກັບ backup ຂອງ 7 ມື້, 4 ອາທິດ ແລະ 12 ເດືອນຫຼ້າສຸດ. ສອງປະເພດນັບແຍກກັນ.

ຖ້າຢາກເກັບສະເພາະ database ໃຫ້ຕັ້ງ `BACKUP_FILES=0`.

ກູ້ໄຟລ໌ຄືນ (ຢຸດ API ກ່ອນ):

```bash
docker compose stop api
sudo tar -xzf data/backups/files_YYYY-MM-DD_HHMM.tar.gz -C data/   # ຂຽນທັບ data/uploads ແລະ data/storage
sudo chown -R 1000:1000 data/uploads data/storage
docker compose start api
```

Backup ຢູ່ໃນ server ດຽວກັນ. ຖ້າ disk ເສຍ, backup ກໍ່ເສຍນຳ. ຄວນ copy `data/backups/` ໄປໄວ້ບ່ອນອື່ນເປັນປະຈຳ.

## ລຶບ UAT ອອກທັງໝົດ

```bash
cd ~/edusmart-uat/backend/deploy/uat
docker compose down -v          # -v ລຶບ database ຂອງ UAT ນຳ
sudo rm /etc/nginx/sites-enabled/edusmart-uat && sudo nginx -t && sudo systemctl reload nginx
```

ຄຳສັ່ງນີ້ບໍ່ກະທົບ container ຫຼື database ຂອງລະບົບອື່ນ, ເພາະທຸກຢ່າງຂອງ UAT ຂຶ້ນຕົ້ນດ້ວຍຊື່ `edusmart-uat`.
