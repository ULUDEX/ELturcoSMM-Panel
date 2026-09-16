# Yayınlama ve Taşıma

## 1. Mevcut ChatGPT Sites yayını

Proje `.openai/hosting.json` ile mevcut Sites projesine bağlıdır. Sites üzerinde yayın yapacak geliştirici, bu dosyadaki `project_id` değerini değiştirmeden platformun kaydetme ve yayınlama akışını kullanmalıdır. D1 binding adı `DB`, R2 binding adı `MEDIA` olmalıdır.

Üretim ortamında şu sırayı izleyin:

1. Ortam değişkenlerini hosting panelinden ekleyin.
2. `pnpm install --frozen-lockfile` çalıştırın.
3. `pnpm build` ile derleyin.
4. `drizzle/` altındaki migration dosyalarını numara sırasıyla D1'e uygulayın.
5. Yeni sürümü yayınlayın.
6. `/`, `/admin`, hizmet listesi, destek ve test siparişi akışını kontrol edin.

## 2. Yerel D1 kurulumu

Önce build alın:

```bash
pnpm build
```

Ardından `drizzle/0000_...sql` dosyasından başlayarak her migration'ı bir kez uygulayın:

```bash
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_faithful_swordsman.sql
```

Dosya adını sırasıyla `0001`, `0002` şeklinde değiştirin. Aynı migration'ı tekrar çalıştırmayın.

## 3. GitHub üzerinden çalışma

- `main`: yayınlanabilir kararlı kod
- Her değişiklik: `feature/kisa-aciklama` veya `fix/kisa-aciklama` branch'i
- Değişiklik bitince pull request açın
- Pull request'te build sonucunu ve gerekli yeni ortam değişkenlerini yazın

Bu düzen sayesinde site sahibinin ChatGPT limiti dolsa bile herhangi bir geliştirici depoyu klonlayıp kaldığı yerden devam edebilir.

## 4. Başka Cloudflare hesabına tamamen taşıma

Yeni hesapta ayrı bir D1 veritabanı ve R2 bucket oluşturun. Binding adlarını sırasıyla `DB` ve `MEDIA` tutun. Migration'ları yeni D1'e uygulayın, ortam değişkenlerini hosting paneline girin ve domain DNS'ini yeni yayına yönlendirin.

Mevcut üretim verileri otomatik olarak GitHub'a gelmez. Siparişler, destek konuşmaları ve ödeme kayıtları taşınacaksa eski D1 veritabanından güvenli export alıp yeni D1'e import etmek gerekir. Medya dosyaları da eski R2'den yeni R2'ye ayrıca kopyalanmalıdır.

## 5. Domain

Özel alan adı `elturkosmm.com` olarak planlanmıştır. DNS değerlerini yalnızca seçilen hosting sağlayıcısının güncel ekranında gösterilen kayıtlarla değiştirin. Eski yayını doğrulamadan DNS kayıtlarını silmeyin.
