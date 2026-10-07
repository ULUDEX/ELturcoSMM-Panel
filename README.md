# ElTurco SMM Panel

ElTurco SMM'nin bağımsız kaynak kod deposudur. Site vitrini, sipariş formu, hizmet yönetimi, ödeme talepleri, destek konuşmaları, müzik/radyo ve yönetim paneli bu depoda birlikte bulunur.

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
git clone https://github.com/ULUDEX/ELturcoSMM-Panel.git
cd ELturcoSMM-Panel
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
| `SMM_PROVIDER_USD_TRY_RATE` | İsteğe bağlı | Sabit USD/TRY kuru; boşsa TCMB kuru kullanılır |
| `TELEGRAM_BOT_TOKEN` | Telegram duyuruları için | BotFather tarafından verilen bot tokenı; yeni hizmetleri duyurur |
| `SMTP_HOST` | E-posta için | Gmail SMTP sunucusu; `smtp.gmail.com` |
| `SMTP_PORT` | E-posta için | TLS SMTP portu; `465` |
| `SMTP_USER` | E-posta için | Gmail adresi; varsayılan `elturcosmm@gmail.com` |
| `SMTP_PASS` | E-posta için | Gmail uygulama şifresi; production secret olarak ayarlayın |
| `EMAIL_FROM` | E-posta için | Gönderen adresi; varsayılan `ElTurco SMM <elturcosmm@gmail.com>` |
| `SITE_URL` | İsteğe bağlı | E-posta bağlantılarında kullanılacak HTTPS site adresi |
| `TELEGRAM_CHAT_ID` | İsteğe bağlı | Duyuru hedefi; boş bırakılırsa `@ElTurcoSmm` kullanılır |
| `KIVIL_API_KEY` | Harici API için | `/api/v1` erişim anahtarı |
| `SHOPIER_ACCESS_TOKEN` | Shopier için | Shopier erişim anahtarı |
| `SHOPIER_WEBHOOK_SECRET` | Shopier için | Webhook doğrulama sırrı |
| `SHOPIER_CHECKOUT_URL` | Shopier için | Ödeme sayfası adresi |

## Önemli adresler

- Site: `/`
- Yönetim: `/admin`
- Genel API: `/api/v1`
- Shopier webhook: `/api/shopier/webhook`
- Telegram hizmet duyuruları: yeni PanelFollows hizmetleri otomatik olarak `@ElTurcoSmm` adresine gönderilir; bot bu kanalda yönetici olmalıdır.

## Müşteri bildirimleri ve şifre kurtarma

Sipariş oluşturma ve durum değişiklikleri ile bakiye yükleme sonuçları müşteri hesabındaki **Bildirimler** kutusuna eklenir. Admin paneli → **Site Düzenleyici → Çok dilli duyuru yayınla** bölümünden Türkçe, İngilizce, İspanyolca, Rusça, Portekizce ve Almanca metin hazırlayıp kayıtlı hesaplara uygulama içi duyuru gönderebilirsiniz.

Şifremi unuttum bağlantısı, e-posta adresini açıklamayan yanıt verir ve 30 dakika geçerli, tek kullanımlık bağlantı gönderir. Gmail için `smtp.gmail.com:465` ve `elturcosmm@gmail.com` kullanılır. Google hesabında 2 Adımlı Doğrulama açıkken ayrı bir uygulama şifresi oluşturun; normal Google şifresini kullanmayın. GitHub → **Settings → Environments → production** bölümünde `SMTP_PASS` değerini **Environment secret** olarak ekleyin. Gönderen adresi varsayılan olarak `ElTurco SMM <elturcosmm@gmail.com>` biçimindedir.

## Telegram yeni hizmet duyuruları

PanelFollows kataloğuna ilk kez eklenen her hizmet Telegram hedefinde tek duyuruya eklenir. Bot tokenı yoksa bildirimler D1 kuyruğunda bekler. Varsayılan hedef `@ElTurcoSmm`; başka grup veya kanal için `TELEGRAM_CHAT_ID` değerini kullanın.

Kurulum: Telegram’da `@BotFather` üzerinden bir bot oluşturun, botu `@ElTurcoSmm` kanalına yönetici olarak ekleyip mesaj gönderme izni verin. BotFather’ın verdiği tokenı GitHub deposunun **Settings → Environments → production → Environment secrets** bölümüne `TELEGRAM_BOT_TOKEN` adıyla ekleyin. Hedefi değiştirecekseniz aynı yere `TELEGRAM_CHAT_ID` secret’ını ekleyin. Ardından **Actions → Deploy to Cloudflare → Run workflow** ile bir dağıtım başlatın. Tokenı sohbet veya kod içine yazmayın. Bağlantı durumu admin panelindeki **Entegrasyonlar** bölümünde görünür.

## Projeyi devralacak kişi için

Önce [PROJECT_STATUS.md](PROJECT_STATUS.md), sonra [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) dosyasını okuyun. Yapay zekâ ile devam edecekseniz [HANDOFF_PROMPT.md](HANDOFF_PROMPT.md) içeriğini yeni sohbete yapıştırın.

## Güvenlik

- `.env.local`, API anahtarları ve şifreler Git'e gönderilmez.
- Eski konuşmalarda paylaşılmış admin şifreleri kullanılmamalı; canlı ortamda yeni ve benzersiz değer belirlenmelidir.
- Gerçek ödeme veya sağlayıcı bağlantısı açılmadan önce webhook imzası ve test siparişi doğrulanmalıdır.

## Lisans ve medya

Bu depo özel proje kullanımı içindir. Lisanslı MP3 dosyaları GitHub üzerinden dağıtılmaz. Müziği admin medya yükleyicisinden ekleyin veya kullanım hakkı bulunan dosyaları yerelde `public/site/audio` altına koyun.

## Canlı destek ve Yardım Merkezi

ELturcoSMM’nin giriş, müşteri paneli ve hizmet sayfaları `public/live-support.js` ile tawk.to canlı sohbetine bağlanır. Sohbet kurulumu ELturcoSMM property’sini kullanır; Kıvıl Digital’e bağlantı eklenmez. Widget kimlikleri herkese açık embed tanımlarıdır, gizli API anahtarı değildir. Müşteri e-posta adresi ve hesap bilgileri otomatik olarak üçüncü tarafa aktarılmaz. Yardım Merkezi: https://elturcosmmcom.tawk.help. Çevrimdışı ziyaretçiler sohbet formuna mesaj bırakabilir. Widget engellenirse “Canlı desteği aç” düğmesi doğrudan sohbet bağlantısı sunar. Mevcut panel içi destek mesajları korunur. AI Assist ayrıca etkinleştirilmedikçe sohbet yanıtlarını destek temsilcisi verir.
