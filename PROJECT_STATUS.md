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
