# Bağımsız Cloudflare kurulumu

Bu kurulum GitHub'daki `main` dalına gelen her değişikliği Cloudflare Workers'a otomatik yayınlar. Uygulama mevcut `DB` (D1) ve `MEDIA` (R2) binding adlarını korur.

## 1. Cloudflare kaynaklarını oluştur

Cloudflare panelinde:

1. `elturko-smm-db` adlı bir D1 veritabanı oluştur.
2. `elturko-smm-media` adlı bir R2 bucket oluştur.
3. D1 veritabanı kimliğini ve Cloudflare Account ID değerini not et.
4. GitHub Actions için yalnızca bu hesaptaki Workers, D1 ve R2 dağıtımına gereken izinlere sahip ayrı bir API token oluştur.

API token, admin şifresi veya oturum sırrını hiçbir dosyaya yazma ve sohbette paylaşma.

## 2. GitHub Actions ayarları

GitHub'da **Settings → Secrets and variables → Actions** bölümüne gir.

Repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Repository variables:

- `CF_D1_DATABASE_ID`: oluşturduğun D1 veritabanı kimliği
- `CF_D1_DATABASE_NAME`: `elturko-smm-db`
- `CF_R2_BUCKET_NAME`: `elturko-smm-media`
- `CF_WORKER_NAME`: `elturko-smm`

## 3. İlk veritabanı kurulumu

İlk yayından önce `drizzle/` altındaki SQL dosyalarını numara sırasıyla yeni D1 veritabanına yalnızca bir kez uygula:

```bash
pnpm exec wrangler d1 execute elturko-smm-db --remote --file drizzle/0000_faithful_swordsman.sql
pnpm exec wrangler d1 execute elturko-smm-db --remote --file drizzle/0001_elite_carmella_unuscione.sql
pnpm exec wrangler d1 execute elturko-smm-db --remote --file drizzle/0002_dashing_spitfire.sql
pnpm exec wrangler d1 execute elturko-smm-db --remote --file drizzle/0003_confused_sister_grimm.sql
pnpm exec wrangler d1 execute elturko-smm-db --remote --file drizzle/0004_famous_gamora.sql
pnpm exec wrangler d1 execute elturko-smm-db --remote --file drizzle/0005_dashing_wolverine.sql
```

Aynı migration dosyasını ikinci kez çalıştırma.

## 4. Yönetim paneli sırları

İlk Worker yayını oluştuktan sonra Cloudflare Worker ayarlarında aşağıdaki değerleri **Secret** olarak ekle:

- `ADMIN_PASSWORD`: yalnızca senin bildiğin güçlü admin şifresi
- `ADMIN_SESSION_SECRET`: uzun ve rastgele ayrı bir değer

İsteğe bağlı entegrasyonlar açıldığında `.env.example` içindeki sağlayıcı ve Shopier değerlerini de Worker secret olarak ekle.

## 5. Yayınlama

Bu dal `main` ile birleştirildikten sonra her `main` güncellemesi otomatik yayınlanır. İlk kurulumu elle başlatmak için GitHub'da **Actions → Deploy to Cloudflare → Run workflow** seçeneğini kullan.

Yayın tamamlandıktan sonra kontrol et:

- Ana site: Worker'ın verdiği adres
- Yönetim: Worker adresi + `/admin`
- Hizmet listesi ve sipariş formu
- Medya yükleme
- Test siparişi ve destek akışı

## 6. Özel alan adı

Worker düzgün çalıştıktan sonra `elturkosmm.com` alan adını Cloudflare'da Worker'a bağla. Yeni yayın doğrulanmadan eski DNS kayıtlarını silme.
