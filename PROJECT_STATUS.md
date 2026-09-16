# Proje Durumu

Son güncelleme: 16 Eylül 2026

## Çalışan bölümler

- Mobil uyumlu ELTURKO SMM müşteri arayüzü
- Kategoriye göre hizmet seçme ve tutar hesaplama
- Sipariş oluşturma, kaydetme ve sağlayıcıya iletmeyi deneme
- Admin oturumu ve 15 dakikalık başarısız giriş sınırlaması
- Hizmet ekleme, düzenleme, aktif/pasif yapma ve silme
- Sipariş, ödeme talebi, gelir-gider ve destek yönetimi
- Site metinleri ve görünürlük ayarları
- Müzik listesi ve R2 medya yükleme altyapısı (lisanslı MP3 dosyaları GitHub'da dağıtılmaz)
- D1 veritabanı şeması ve migration geçmişi
- Shopier webhook ve mükerrer ödeme koruması için altyapı
- SMM sağlayıcı API ve reseller API uçları

## Canlı ortam bilgisi

- Mevcut Sites yayını: `https://kivildigital-smm.ahmetcankorkmaz1613.chatgpt.site`
- Özel alan adı hedefi: `elturkosmm.com`
- Sites proje kimliği: `.openai/hosting.json` içinde kayıtlıdır.

## Canlıya almadan önce tamamlanacaklar

1. Hosting ortamına yeni `ADMIN_PASSWORD` ve rastgele `ADMIN_SESSION_SECRET` girin.
2. Kullanılacak SMM sağlayıcısının URL ve API anahtarını ekleyin; küçük bir test siparişi yapın.
3. Shopier hesabı hazırsa gerçek checkout URL, access token ve webhook secret girin.
4. Shopier webhook adresini panelde `/api/shopier/webhook` olarak tanımlayın ve imza doğrulamasını test edin.
5. `elturkosmm.com` DNS kayıtlarını seçilen hosting sağlayıcısına bağlayın.
6. `public/site/audio` içindeki tüm ses dosyalarının ticari yayın hakkını kontrol edin.

## Bilinen ürün eksikleri

- Müşteri üyeliği ve müşteriye özel kalıcı bakiye ekranı tam ürün akışı olarak bitmiş değil.
- Sipariş takibi müşteri hesabına bağlı değil.
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
- `.openai/hosting.json`: Mevcut ChatGPT Sites bağlantısı
