# Proje Durumu

Son güncelleme: 27 Eylül 2026

## Çalışan bölümler

- Mobil uyumlu ELTURCO SMM müşteri arayüzü
- Kategoriye göre hizmet seçme ve tutar hesaplama
- Sipariş oluşturma, kaydetme ve sağlayıcıya iletmeyi deneme
- Admin oturumu ve 15 dakikalık başarısız giriş sınırlaması
- Hizmet ekleme, düzenleme, aktif/pasif yapma ve silme
- Sipariş, ödeme talebi, gelir-gider ve destek yönetimi
- Site metinleri ve görünürlük ayarları
- Müzik listesi ve R2 medya yükleme altyapısı
- D1 veritabanı şeması ve migration geçmişi
- Shopier webhook ve mükerrer ödeme koruması için altyapı
- SMM sağlayıcı API ve reseller API uçları

## Canlı ortam bilgisi

- Cloud/Sites yayını: ELTURCO SMM Panel
- Özel alan adı hedefi: `elturcosmm.com`
- Sites proje kimliği: `.openai/hosting.json` içinde kayıtlıdır.
- Eski KıvılDigital adı ve bağlantıları bu projeden kaldırılmalıdır; ELTURCO SMM tek marka olarak kullanılmalıdır.

## Canlıya almadan önce tamamlanacaklar

1. Hosting ortamına yeni `ADMIN_PASSWORD` ve rastgele `ADMIN_SESSION_SECRET` girin.
2. PanelFollows sağlayıcısının URL ve API anahtarını ekleyin; küçük bir test siparişi yapın.
3. Shopier hesabı hazırsa gerçek checkout URL, access token ve webhook secret girin.
4. Shopier webhook adresini panelde `/api/shopier/webhook` olarak tanımlayın ve imza doğrulamasını test edin.
5. `elturcosmm.com` DNS kayıtlarını seçilen hosting sağlayıcısına bağlayın.
6. `public/site/audio` içindeki tüm ses dosyalarının ticari yayın hakkını kontrol edin.

## Tamamlanan müşteri özellikleri

- Hesap içi sipariş ve bakiye bildirimleri, okundu durumu ve çok dilli admin duyuruları
- Sipariş geçmişinde durum adımları ve sağlayıcı durum yenileme
- Memoji tarzı kadın/erkek avatar seçimi ve avatarın hesapta saklanması
- Giriş yapmış müşteriler için şifre değiştirme ve tek kullanımlık e-posta kurtarma bağlantısı

Canlı ortamda e-posta göndermek için Gmail SMTP (`smtp.gmail.com:465`) kullanılır. `SMTP_PASS`, GitHub production environment içinde `SMTP_PASS` secret olarak tanımlanmalıdır. Gmail hesabında 2 Adımlı Doğrulama açık olmalı ve ayrı bir uygulama şifresi kullanılmalıdır. Yeni D1 tabloları migration `0012_customer_notifications_and_password_resets.sql` ile oluşturulur; Cloudflare deploy iş akışı dağıtımdan önce migration uygular.

## Bilinen ürün eksikleri

- Müşteri üyeliği ve müşteriye özel kalıcı bakiye ekranı tam ürün akışı olarak bitmiş değil.
- Sipariş geçmişi giriş yapan müşteriye bağlıdır; durum adımları ve yenileme müşteri hesabındaki sipariş ekranında bulunur.
- Shopier gerçek hesap bilgileri olmadan ödeme otomatik çalışmaz.
- Sağlayıcı API bilgileri olmadan siparişler otomatik teslim edilmez; admin panelinde beklemede kalır.
- Üretim öncesi uçtan uca ödeme, webhook ve sağlayıcı hata senaryosu testi gerekir.

## Dosya haritası

- `app/page.tsx`: Ana site kabuğu
- `public/site/`: Müşteri panelinin HTML/CSS/JS ve medya dosyaları
- `app/admin/`: Admin giriş ve yönetim arayüzü
- `app/api/`: Sipariş, hizmet, destek, ödeme ve admin API'leri
- `db/schema.ts`: Veritabanı modelleri
- `drizzle/`: Sıralı SQL migration dosyaları
- `lib/provider.ts`: SMM sağlayıcı bağlantısı
- `lib/admin-auth.ts`: Admin oturum doğrulaması
- `.openai/hosting.json`: Mevcut Cloud/Sites bağlantısı

## 10 Ekim 2026 · Yönetim modülleri

Önceden kapalı 20 bölüm için ekranlar, kalıcı kayıtlar, rol izinleri ve API kontrolleri eklendi. Rapor/CSV, içerik ve kara liste yönetimi, personel oturumları, ödeme bonusu, planlı sipariş rezervasyonu/iptali, zamanlayıcı durumu hazır. Blog yazıları, SSS, duyurular ve dil metinleri müşteri tarafına bağlandı. Abonelikler aynı URL için planlı tekrar kapsamındadır; otomatik yeni gönderi keşfi yoktur. Yetki, bakiye, tekrar gönderim ve bonus testleri offline çalışır. Önceki Shopier aktivasyon kısıtı devam eder.

## Pazaryeri katalog düzeni — 10 Ekim 2026
- Ayrı tedarikçi sütunu, tedarikçi filtresi, iki servis kimliği, seçilen hizmet kartı ve 25 hizmetlik sayfalama.
- Hizmet değişiminde özel alanlar temizlenir ve adet hizmet limitlerine göre belirlenir.
- Boş satış tutarı için varsayılan fiyat kuruştan TL’ye çevrilerek gönderilir; geçmişteki kayıtlar değiştirilmez.
# Localization update — 2026-10-10

Nine storefront locales with real flag assets, seven daily display currencies, complete sentence/service translation with shared D1 cache and guarded Workers AI, source-preserving language changes, and admin translation search/manual overrides. New public text is detected automatically; first-time translations can queue under the daily cap. Tawk.to remains the support system with per-language native widgets and custom cards in the existing property; global Turkish-only automation messages are replaced by localized card content. Existing supplier pricing, balances, order routing, catalog synchronization and Telegram delivery remain intact. Localization migration and CI tests are included.

## Translation performance — 2026-10-10

Removed three-second serial delays, doubled batches with bounded concurrency, prioritize visible text and defer hidden panels, batch-lookup requested automatic translations alongside preloaded manual corrections, and read cached batch entries in one indexed query. Frontend checks the shared cache before sending new AI work; unrelated visitor text is never enumerated. Production is Workers Paid; localization and catalog indexes are deployed. Current translation model: llama-3.3-70b-instruct-fp8-fast.

## Customer workspace polish — 2026-10-10

Compact flag/language picker moves before search on desktop and to the left of currency controls on mobile. Tawk waits for actual onLoad, queues clicks and offers the selected-language direct chat link if loading is blocked. Order submit disables both buttons during requests, catches uncertain network outcomes, refreshes the balance after success and displays the same integer-cent charge as the server. Changing categories resets stale descriptions and custom fields; changing languages preserves quantities. Catalog includes service IDs and per-order/per-1000 units. Account order history adds local search/status filtering and quantity/target details, retaining the last list on network failure. Partnership and integration pages replace construction placeholders with truthful support workflows; customer API credential provisioning remains manual. Payment flow unchanged.

Admin support now links to the active Tawk.to inbox instead of presenting the legacy site ticket list as the current support channel; existing internal records remain accessible.

## 28 Ekim 2026 · Özel kabul sürümü

Kaynak: GitHub main `1bfc359`. Canlı Cloudflare/PanelFollows veritabanında yazma işlemi yapılmadı. Eski Sites kaynağı (`9ae06da`) incelendi; daha eski ve kataloğu boş olduğundan güncel GitHub kodu esas alındı. Kök `public/index.html` eski vitrini gölgeliyordu; tek karşılama sayfasına yönlendirildi. Katalogdaki tanımsız `newServicesSince` hatası kaldırıldı, boş katalog 200/[] döner. Matematik doğrulaması sunucu ile uyumlu hale getirildi. Profil görünen adı ve avatar hesaba kalıcı kaydedilir. Temel arayüz 9 dil için yerel sözlük içerir. Yeni SMMXServer satırları pasif başlar; eşitleme mevcut aktif/pasif kararını korur ve pasif yeni servisleri duyurmaz.

Özel kabul ortamının D1/R2 kaynakları ayrıdır. `PRIVATE_PREVIEW=1` ile gerçek ödeme, sipariş, iptal/telafi ve zamanlanmış işler kapatılır. Bu ortamda platform kimliği olan sahip için kalıcı test hesabı ve açıkça etiketlenmiş test doğrulama bağlantısı vardır. Bu seçenek üretim ortamında etkinleştirilmez. SMTP ve sağlayıcı sırları kopyalanmadı; gerçek teslimat/ödeme testi yapılmadı. Test kataloğu ve siparişleri yalnızca geçici bellek içi SQL testlerinde oluşturulur.

Doğrulama: account-workflow, catalog-filter, provider, admin-module, orders-refill, panel-workspace, customer-experience, panel-layout, localization, localization-ui, live-support ve music-upload testleri geçti. Vinext üretim derlemesi geçti. Genel TypeScript kontrolü depodan gelen kapsamlı mevcut tür hataları nedeniyle geçmiyor; bunlar bu kabul sürümünde tamamen giderilmiş sayılmaz. Tarayıcıda karşılama → kayıt geçişi, açık kayıt sekmesi, doğrulama alanı ve hata vermeden yüklenen varlıklar kontrol edildi.

Herkese açık ana dal/Netlify önizlemesi otomatik yayın tetikleyebileceğinden bu turda GitHub'a push yapılmaz. Özel kaynak yayını korunur; ana alan adına geçiş için ayrı kullanıcı onayı gerekir.

## 29 Ekim 2026 · Bayilik / API / son siparişler

Aylık 25 USD bayilik başvuru, ödeme referansı, yönetici onayı, dönem sonu/iptal ve müşteriye özel müşteri listesi eklendi. API anahtarları bayilikten bağımsızdır; oluşturma/yenileme/iptal, tek sefer gösterim, hash saklama ve kalıcı istek sınırı hazır. `/api/v1` siparişleri müşteri bakiyesini kullanan mevcut site sipariş işleyicisine bağlandı; idempotency/hesap sahipliği test edildi. Eski ortak API anahtarı üzerinden hesapsız sipariş kaldırıldı; mevcut tarihî PanelFollows siparişleri korunur. Yeni migration yalnızca yeni tablolar oluşturur.

Gerçek SVG marka logoları yerel dosyalardan sunulur. Son siparişler logo, tutar, tarih ve durum rozeti olan tıklanabilir kartlar haline getirildi. Bayilik ve API sayfaları ayrı ekranlardır; API kullanım örnekleri ve hizmet alanları açıklanır. Görünmez sekmede dekoratif hareket durur; mobilde görünen dekor sayısı azaltılır ve reduced-motion tercihi korunur. Yerel görsel testte örnek sipariş verisi kullanılır; bu test dosyaları yayımlanmaz.

Yayın sonrası doğrulama: özel sürüm 2 başarıyla açıldı; yeni altı API/bayilik tablosu mevcut. `/api/services` sunucuda 200/[] döndü; üretimden salt okunur katalog alınamadı. Eski Sites projesinin ortamında sağlayıcı URL'leri var, fakat SMM_PROVIDER_API_KEY tanımlı değil. Canlı Cloudflare sırları bağlı araçlarda erişilebilir değil. Bu nedenle gerçek hizmetlerin görünmesi sağlayıcı veya asıl üretim katalog bağlantısı kurulana kadar bloke; örnek hizmet yayımlanmadı. Müşteri ekranına bu durumu açıklayan katalog bildirimi eklendi.

## Canlı site teşhisi ve yayın adayı — 29 Ekim 2026

Kullanıcı sorunu elturcosmm.com üzerinde gördüğünü doğruladı. Yeni bayilik/API kodu yalnızca özel Sites sürümüne yayınlandığı için bu değişiklikler canlı alanda görünmüyordu. GitHub Actions run 40738790611: sağlayıcı, SMTP ve Turnstile kontrolleri, migration ve Worker yayını başarılı; son katalog okuma HTTP 500 ile başarısız. Üretim sağlayıcı anahtarı mevcut; özel Sites ortamındaki eksik anahtarı üretime genellemek yanlıştı. GitHub main 1bfc359 hizmet API'si `Math.max(newServicesSince,...)` kullanıyor, fakat bu değişken tanımlı değil. Aynı canlı Worker'ın doğrudan /api/services adresinde 500 doğrulandı. Dolu katalog regresyon testi düzeltilmiş kodda geçiyor.

Asıl ULUDEX/ELturcoSMM-Panel checkout'una bayilik/API değişiklikleri ve servis hatası düzeltmesi aktarıldı. Üretim .openai proje kimliği, gerçek D1 database ID, R2 adları, layout metadata ve GitHub yayın akışı korundu. Yeni 0023 yalnızca yeni tablolar oluşturur. Bayilik/API navigasyonu katalog yanıtından bağımsız açılır; seçili bölüm URL'de kalır. Üstte üç görünür kısa yol vardır. Tek kök giriş için gölgeleyen public/index.html kaldırıldı; app/page.tsx /welcome/ yönlendirmesi kullanılır.

Genel yayın için ilk kullanıcı talebindeki ayrı onay beklenir. Bu aday GitHub'a push edilmedi; mevcut canlı sipariş, bakiye, hizmet ve sağlayıcı kayıtlarına yazılmadı.


## 29 Ekim 2026 · Canlı yayın ve çift müşteri API

Kullanıcı onayıyla GitHub main 7c652e96 sürümü elturcosmm.com'a yayınlandı. Actions 40782944258 başarılı; canlı katalog 7.904 hizmet, ana sayfa ve panel varlıkları doğrulandı. Salt okunur ek kontrol 40783314899 görünür Hizmetler/Bayilik/API alanlarını, varlık hashlerini ve kimlik doğrulama sınırlarını doğruladı. Önceki bölümlerdeki yalnız-özel-yayın ve sağlayıcı anahtarı eksik açıklamaları bu canlı sürüm için geçerli değildir.

Sonraki çift API çalışması feature/dual-customer-api dalındadır. Referans: kullanıcı hesabındaki PanelFollows API Genel bakış, v2, v3, Anahtarlar ve Webhook sekmeleri. Kaynak hesaptaki anahtarlar değiştirilmedi, ücretli istek yapılmadı. Klasik v2 uyumluluğu ve REST v3, etiketli bağımsız müşteri anahtarları, önizleme/batch, OpenAPI, olay listesi ve HMAC webhook altyapısı eklendi. Mevcut v1, TRY bakiyeler, PanelFollows kimlikleri ve yeni tedarikçi pasiflik kuralı korunur. Ayrıntılı sözleşme ve açık kapsam sınırları README'nin Müşteri API v2/v3 bölümündedir.
