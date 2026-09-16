# ELTURKO SMM Panel

ELTURKO SMM'nin bağımsız kaynak kod deposudur. Site vitrini, sipariş formu, hizmet yönetimi, ödeme talepleri, destek konuşmaları, müzik/radyo ve yönetim paneli bu depoda birlikte bulunur.

## Teknoloji

- Next.js 16 + React 19
- Vinext / Cloudflare Workers
- Cloudflare D1 (SQLite uyumlu veritabanı)
- Cloudflare R2 (yönetim panelinden yüklenen medya)
- Drizzle ORM ve SQL migration dosyaları
- TypeScript, Tailwind CSS

## Yerel kurulum

Gereksinimler: Node.js 22.13 veya üzeri, Git ve npm/pnpm.

```bash
git clone https://github.com/ULUDEX/kivildigital-smm.git
cd kivildigital-smm
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Tarayıcıda terminalin gösterdiği yerel adresi açın. D1 kullanan tam yerel test için önce bir kez build alın ve `docs/DEPLOYMENT.md` içindeki migration adımlarını uygulayın.

## Gerekli ortam değişkenleri

Gerçek değerleri yalnızca hosting panelinde veya yerel `.env.local` içinde tutun. Repoya şifre ya da API anahtarı yazmayın.

| Değişken | Zorunlu | Amaç |
|---|---:|---|
| `ADMIN_PASSWORD` | Evet | `/admin` giriş şifresi |
| `ADMIN_SESSION_SECRET` | Evet | Admin oturum imzası; uzun ve rastgele olmalı |
| `SMM_PROVIDER_API_URL` | Otomatik teslimat için | SMM sağlayıcı API adresi |
| `SMM_PROVIDER_API_KEY` | Otomatik teslimat için | Sağlayıcı API anahtarı |
| `KIVIL_API_KEY` | Harici API için | `/api/v1` erişim anahtarı |
| `SHOPIER_ACCESS_TOKEN` | Shopier için | Shopier erişim anahtarı |
| `SHOPIER_WEBHOOK_SECRET` | Shopier için | Webhook doğrulama sırrı |
| `SHOPIER_CHECKOUT_URL` | Shopier için | Ödeme sayfası adresi |

## Önemli adresler

- Site: `/`
- Yönetim: `/admin`
- Genel API: `/api/v1`
- Shopier webhook: `/api/shopier/webhook`

## Projeyi devralacak kişi için

Önce [PROJECT_STATUS.md](PROJECT_STATUS.md), sonra [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) dosyasını okuyun. Yapay zekâ ile devam edecekseniz [HANDOFF_PROMPT.md](HANDOFF_PROMPT.md) içeriğini yeni sohbete yapıştırın.

## Güvenlik

- `.env.local`, API anahtarları ve şifreler Git'e gönderilmez.
- Eski konuşmalarda paylaşılmış admin şifreleri kullanılmamalı; canlı ortamda yeni ve benzersiz değer belirlenmelidir.
- Gerçek ödeme veya sağlayıcı bağlantısı açılmadan önce webhook imzası ve test siparişi doğrulanmalıdır.

## Lisans ve medya

Bu depo özel proje kullanımı içindir. `public/site/audio` içindeki müziklerin yayın ve ticari kullanım hakları depo lisansına dahil değildir; site sahibi gerekli hakları ayrıca sağlamalıdır.
