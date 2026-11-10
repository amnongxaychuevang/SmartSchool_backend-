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

ເພີ່ມ **A record**: `uat-edusmart` → IP ຂອງ server.
ກວດດ້ວຍ `dig +short uat-edusmart.phousam.com` ວ່າໄດ້ IP ຂອງ server.

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
docker compose run --rm api npx prisma db push --skip-generate
docker compose run --rm api npx prisma db seed     # ສ້າງ roles ແລະ admin
docker compose up -d
docker compose ps                        # ທັງ 3 container ຕ້ອງ Up
```

**ຫ້າມ** run `db:seed-demo` ຖ້າຈະໃຫ້ຄົນນອກມາທົດສອບດ້ວຍຂໍ້ມູນທີ່ຄ້າຍຂອງແທ້.

## 6. nginx ແລະ SSL

ກ່ອນ reload ຕ້ອງ run `nginx -t` ທຸກຄັ້ງ. ຖ້າ config ຜິດ, ລະບົບອື່ນທີ່ໃຊ້ nginx ດຽວກັນຈະລົ້ມນຳ.

```bash
sudo cp nginx-edusmart-uat.conf /etc/nginx/sites-available/edusmart-uat
sudo ln -s /etc/nginx/sites-available/edusmart-uat /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d uat-edusmart.phousam.com
```

## 7. ກວດຫຼັງ deploy

```bash
curl -I https://uat-edusmart.phousam.com/                  # 200
curl -s -X POST https://uat-edusmart.phousam.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"phoneOrEmail":"admin@smartschool.com","password":"password123"}' | head -c 80
```

ຈາກນັ້ນເປີດໃນ browser, login, ແລ້ວ**ປ່ຽນລະຫັດ admin ທັນທີ**. Seed ຕັ້ງໄວ້ເປັນ `password123` ທີ່ທຸກຄົນຮູ້.

---

## ອັບເດດເວີຊັນໃໝ່

```bash
cd ~/edusmart-uat/backend  && git pull
cd ~/edusmart-uat/frontend && git pull
cd ~/edusmart-uat/backend/deploy/uat
docker compose up -d --build
docker compose run --rm api npx prisma db push --skip-generate   # ຖ້າ schema ປ່ຽນ
```

`db push` ອາດລຶບ column ທີ່ຖືກເອົາອອກຈາກ schema ພ້ອມຂໍ້ມູນໃນ column ນັ້ນ. ໃຫ້ອ່ານສິ່ງທີ່ມັນເຕືອນກ່ອນຕອບ yes.

## ເບິ່ງ log ແລະ backup

```bash
docker compose logs -f api
docker compose logs -f web
ls -lh data/backups/                                   # backup database ອັດຕະໂນມັດທຸກຄືນ
docker exec edusmart-uat-api node scripts/db-backup.js # backup ດ້ວຍມື
```

Backup ອັດຕະໂນມັດເກັບ **ແຕ່ database**. ຖ້າຈະເກັບຮູບ ແລະ ເອກະສານນຳ ໃຫ້ copy `data/uploads` ແລະ `data/storage` ໄປເກັບບ່ອນອື່ນ.

## ລຶບ UAT ອອກທັງໝົດ

```bash
cd ~/edusmart-uat/backend/deploy/uat
docker compose down -v          # -v ລຶບ database ຂອງ UAT ນຳ
sudo rm /etc/nginx/sites-enabled/edusmart-uat && sudo nginx -t && sudo systemctl reload nginx
```

ຄຳສັ່ງນີ້ບໍ່ກະທົບ container ຫຼື database ຂອງລະບົບອື່ນ, ເພາະທຸກຢ່າງຂອງ UAT ຂຶ້ນຕົ້ນດ້ວຍຊື່ `edusmart-uat`.
