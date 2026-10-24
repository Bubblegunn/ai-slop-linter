Kodlama ajanım, kurallar dosyam yasaklamasına rağmen commit mesajlarına, pull request açıklamalarına ve README'lere sürekli uzun tire ve kalıp ifadeler koyuyor ve metin yayına çıkmadan önce hiçbir şey kontrol etmiyor.

ai-slop-linter, commit mesajlarında, pull request açıklamalarında ve Markdown belgelerinde yapay zekâ kokan ifadeleri ve uzun tireleri işaretleyen, CI'da çalışan bir linter'dır. Her bulguyu satır, sütun ve gerekçesiyle listeler; bir kuralın kaynağını `--explain <kural>` gösterir. Makinenizde çalışır, hiçbir model çağırmaz.

```
npx ai-slop-linter README.md
```

![ai-slop-linter, model yazımı bir pull request açıklamasında ve ardından --explain bold-label](docs/demo.gif)

Kayıt, bu depodaki derlemenin düzenlenmemiş çıktısıdır. Lint edilen dosya `bench/corpus` içindeki model yazımı bir örnektir, gerçek bir pull request değildir. Komut, bir dosyada error düzeyinde bulgu varsa veya skor `--max-score` değerini (varsayılan 10) aşıyorsa 1 koduyla çıkar. Bu README üzerinde aynı komut A notu verir.

<p align="center"><a href="README.md">English</a> | Türkçe</p>

`dash` kuralı bugün error düzeyinde, yani tek bir uzun tire çalıştırmayı düşürür. `--ignore dash` ile kapatılır. Varsayılan olarak error kalıp kalmayacağına henüz karar verilmedi; ölçüm [bench/DASH-DEFAULT.md](bench/DASH-DEFAULT.md) içinde.

İlk cümle, kullanıcıların herkese açık issue'larda yazdıklarının bir yorumudur. Kaynaklar [docs/PAIN.md](docs/PAIN.md) içinde, İngilizce.

Bazı okurlar makine yazısının izlerini tanımayı öğrendi: uzun tire, "sadece X değil Y de", "umarım yardımcı olur", "bunun kanıtıdır", her maddenin başındaki kalın etiket.

Bir linter, dedektör değil. Metni bir modelin yazdığına dair olasılık üretmez. Her kural kaynağını söyler; temiz geçmek tek bir anlama gelir: listedeki izlerden hiçbiri yok.

Gerçeklerin korunup korunmadığı varsayılmaz, denetlenir: `slop --compare` bir yeniden yazımın kaybettiği ya da eklediği sayıları, adları, sürümleri, bağlantıları, alıntıları ve kod parçalarını listeler. Hiçbir model çağırmaz ve sıfır bağımlılığı vardır.

Kuralların çoğu Wikipedia'nın [Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing) sayfasından alınmıştır; bu sayfa, makine yazımı düzenlemeleri inceleyen editörlerin sürekli karşılaştığı kalıpları kaydeder. Aşağıdaki kural tablosu her kuralın kaynağını gösterir.

## Kurulum

Üç yol, tek kural seti.

- Komut satırı: `npx ai-slop-linter README.md`, npm'den. npm'deki sürüm 0.1.10'dur. Bu sürüm `--language` alır, ama bir dosyanın dilini kendisi algılamaz, diyaloğu muaf tutmaz ve `--compare` içermez; bunlar yayımlanmamış 0.2.0 sürümündedir. <!-- release-status -->
- Ajan becerisi: `npx skills add Bubblegunn/ai-slop-linter`. Beceri, bir ajanın yazdığı metni kendisinin denetlemesini ve her yeniden yazımdan sonra gerçekleri karşılaştırmasını sağlar.
- Claude Code eklentisi: `/plugin marketplace add Bubblegunn/ai-slop-linter`, ardından `/plugin install ai-slop-linter@ai-slop-linter`.

## Önce ve sonra

Girdi [`bench/head-to-head/fixtures/h2/README.md`](bench/head-to-head/fixtures/h2/README.md) dosyasıdır. Aşağıdaki çıktı bu sürümün ona verdiği çıktıdır; çıktı İngilizce olduğu için aynen bırakıldı.

````markdown
# Fastq

Fastq 2.3 is not just a queue — it's a game-changer for modern backends. Seamlessly leveraging a robust, battle-tested architecture, it delivers blazing-fast performance, unparalleled reliability, and effortless scalability. In benchmarks, Fastq 2.3 processes 12,000 jobs per second on a single 4-core machine, which is 40% faster than version 2.2. Maintainers at Acme Corp reported a 35% drop in p99 latency on their staging cluster. It requires Node 20 or later and is released under the MIT license. Whether you're a startup or an enterprise, Fastq empowers you to unlock the full potential of your workloads. The future of job processing is here.

## Install

```sh
npm install fastq@2.3
```

See the [changelog](CHANGELOG.md) for details.
````

```
$ npx ai-slop-linter bench/head-to-head/fixtures/h2/README.md
bench/head-to-head/fixtures/h2/README.md  F (score 85.5, 117 words, 8 findings)
     3:14  warning not-x-but-y          "not just X but Y": say the thing itself
     3:30  error   dash                 em dash
     3:40  warning ai-vocabulary        "game-changer": a word models reach for; use the plain one
     3:74  warning ai-vocabulary        "Seamlessly": a word models reach for; use the plain one
     3:85  warning ai-vocabulary        "leveraging": a word models reach for; use the plain one
     3:98  warning ai-vocabulary        "robust": a word models reach for; use the plain one
     3:172 warning sales                "unparalleled": sounds like an advertisement; give the fact instead
     3:569 warning ai-vocabulary        "unlock the": a word models reach for; use the plain one

Why any of these is a tell, and what to write instead: slop --explain not-x-but-y
```

Yeniden yazım, [`bench/head-to-head/golden/h2/README.md`](bench/head-to-head/golden/h2/README.md), aynı paragrafın elle yazılmış hâlidir:

````markdown
# Fastq

Fastq 2.3 is a queue for job processing. In benchmarks, Fastq 2.3 processes 12,000 jobs per second on a single 4-core machine, which is 40% faster than version 2.2. Maintainers at Acme Corp reported a 35% drop in p99 latency on their staging cluster. It requires Node 20 or later and is released under the MIT license.

## Install

```sh
npm install fastq@2.3
```

See the [changelog](CHANGELOG.md) for details.
````

A notu alır ve tek bulgu yoktur:

```
$ npx ai-slop-linter bench/head-to-head/golden/h2/README.md
bench/head-to-head/golden/h2/README.md  A (score 0, 69 words, 0 findings)
```

`--compare` yeniden yazımı özgün metinle karşılaştırır:

```
$ npx ai-slop-linter --compare bench/head-to-head/fixtures/h2/README.md bench/head-to-head/golden/h2/README.md
facts: 11 kept, 0 lost, 0 added
OK: no fact lost or added
```

## Karşılaştırma

Altı başka Claude Code skill'i (Humanizer, unslop, everwrite, slopless, avoid-ai-writing ve slop-cop; ilk üçü ayrıca adıyla çağrılarak) ve eklentisiz Claude ile düzenleme görevlerinde, betik denetimleri ve kör değerlendirmeyle yapılan bir karşılaştırma. Bu görevlerdeki bir sonuçtur, genel bir sıralama değildir.

![Benchmark round 8. Public set: ai-slop-linter 58.67 of 60, first of 11 arms. Held-out set: four arms at 29.67 or more of 30, a near-tie.](docs/benchmark-round8.png)

<!-- h2h:start -->
Round 8 (2026-10-23, Sonnet 5.5, 11 kol, her biri 3 koşu): 12 public görevde bu linter 60 üzerinden 58.67, en iyi diğer kol (adıyla çağrılan Humanizer) 56.00 aldı; farkın %95 bootstrap aralığı [1.00, 4.33]. Kodu okumamış bir yazarın yazdığı 6 held-out görevde dört kol 30 üzerinden 29.67 ya da üstünde aldı (bu linter 29.67, unslop 30.00); bu set onları ayırmıyor. Bütün hücreler, dondurulmuş protokolden sapmalar ve yeniden hesaplama adımı bench/head-to-head/results/round8-final-2026-10-23/ içinde; turlar ve kararlar docs/HEAD-TO-HEAD.md dosyasında; görevler, ölçütler ve harness bench/head-to-head/ içinde herkese açıktır.
<!-- h2h:end -->

## Diğer komutlar

```
npx ai-slop-linter                    # bulunduğunuz dizindeki her .md dosyası
npx ai-slop-linter --commit           # son commit mesajı
npx ai-slop-linter README.md --fix    # güvenli düzeltmeleri yerinde uygula
```

Etkileşimli bir terminalde, temiz bir çalıştırmadan sonra makine başına bir kez bir yıldız ipucu görünür; `--quiet` veya `AI_SLOP_LINTER_NO_STAR_HINT=1` ile kapatılır.

`slop` aynı ikili dosyanın kısa adı. Kuralları kendi metninizde kurmadan önce tarayıcıda denemek için: [bubblegunn.github.io/ai-slop-linter](https://bubblegunn.github.io/ai-slop-linter/).

## Kurallar

Yirmi üç kural. Çoğu, binlerce makine yazımı düzenlemeyi inceleyen editörlerin yazdığı
Wikipedia sayfasından geliyor: [Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing).
"house" işaretli üçü bizim. Tam liste ve kaynaklar için `npx ai-slop-linter --rules`
veya İngilizce README'deki tablo.

- error (her zaman yanlış, çalıştırmayı düşürür): uzun tire, sohbet botu kalıntısı
  ("Umarım yardımcı olur"), bilgi kesim tarihi uyarısı.
- warning (cümleyi yeniden yazın): "sadece X değil Y", zorlama üçlemeler, "asıl
  soru şu", virgülden sonra gelen "-arak/-erek" kuyruğu, şişirilmiş önem, yapay zekâ
  kelime dağarcığı, reklam dili, belirsiz kaynak, giriş anonsu, boş olumlu kapanış,
  liste maddesinde kalın etiket, süs emojisi.
- info (fırsat bulunca): dolgu ifadeler, kıvrımlı tırnak, Her Kelimesi Büyük Başlık,
  kalıp "zorluklar ve gelecek" bölümü, tireli bileşik yoğunluğu.

Kod blokları, satır içi kod, front matter, bağlantı hedefleri, URL'ler ve HTML
kurallardan önce maskelenir; kod örneğindeki bir tire asla bulgu olmaz.

Yanlış bulduğunuz bir uyarıyı susturmak için:

```markdown
<!-- slop-ignore-next-line KURAL -->
<!-- slop-ignore KURAL-A, KURAL-B -->    (buradan dosya sonuna kadar)
```

## Depoda

Pull request'lerde Action, başlığı, açıklamayı ve değişen her Markdown dosyasını lint
eder, diff üzerine satır satır not düşer ve pull request'in altında her push'ta
güncellenen tek bir bulgu tablosu tutar (`pull-requests: write` ister; `comment: "false"`
ile yalnızca notlar kalır):

```yaml
- uses: Bubblegunn/ai-slop-linter@v0
```

Geçmişi olan bir depoda `--baseline-write` bugünkü bulguları kaydeder, `--baseline` yalnızca
yenilere takılır; önce temizlik commit'i gerekmez.

Commit mesajları için bir `commit-msg` kancası:

```
curl -fsSL https://raw.githubusercontent.com/Bubblegunn/ai-slop-linter/main/scripts/install-hook.sh | sh
```

commitlint kullananlar için aynı kural bir eklenti olarak var:
`extends: ["ai-slop-linter/commitlint/config"]`. VS Code'da `.vscode/tasks.json` içindeki
görev, bulguları Sorunlar paneline ve metnin içine taşır.

Ajanlar için skill, ajanın commit mesajını veya PR açıklamasını teslim etmeden önce
kendi metnini lint etmesini sağlar:

```
npx skills add Bubblegunn/ai-slop-linter
```

## Bir bulgu nereyi gösterir

Her bulgu bir satır ve bir sütun taşır. Sütun, satırın başından itibaren mantıksal sırada
sayılan, 1'den başlayan bir UTF-16 kod birimi konumudur. Editörünüzün durum çubuğunda gördüğünüz
sayı, GitHub'ın iş akışı açıklamalarında kullandığı sayı ve bir dil sunucusunun bildireceği sayı
budur; yani JSON'u okuyan bir araç, yazının hangi alfabede olduğunu bilmeden bulguya
atlayabilir.

Arapça ya da İbranice okuyan biri için bunu açıkça söylemek gerekir, çünkü mantıksal sıra gözün
gördüğü sıra değildir: sağdan sola bir satırda 12. sütundaki karakter, metnin başından itibaren
12. karakterdir ve ekranın sağ kenarına yakın çizilir, soldan 12. konumda değil. Sütunu çizim
sırasına göre saymak, bu sayıyı kullanan bütün editörleri bozar ve alfabelerin karıştığı bir
satırda yine belirsiz kalır. Bu yüzden sütun mantıksal kalıyor ve bulgu, eşleştiği metnin bir
`excerpt` parçasını da taşıyor: okumak için güvenilir olan parça alıntıdır, sütun ise oraya
atlayacak araç içindir.

## İngilizce yazmıyorsanız

Kelime kuralları İngilizce kelime listeleridir; başka bir dilde hiçbir şey bulmazlar. Buradaki belirleyici kural `dash`tır, çünkü doğru yazılmış Fransızca, Lehçe veya Rusça noktalama İngilizce bir tire değildir. Araç her dosyanın dilini şöyle bulur: `.slop.json` içindeki `"language"`, `--language`, ön maddedeki `lang:` anahtarı, ya da metnin kendisi (Fransızca, İspanyolca, Almanca, İtalyanca, Portekizce ve Hollandaca için). İngilizce olmayan metinde `dash` ve `title-case-heading` çalışmaz ve çıktı dilin ne olduğunu yazar. Diyalog tireleri ve `« »`, `‹ ›`, `„ “` alıntıları içindeki tireler muaftır. İngilizce bir paragrafın içinde 12 belirteçten kısa bir alıntı muaf değildir.

Fransızca paketinde tek kural vardır, `fr/closer`, ve geçicidir. İspanyolca ve Almanca paketlerinde kural yoktur. Ölçülen oranlar ve sınırlar [docs/LANGUAGES.md](docs/LANGUAGES.md) içinde; ölçülen adayların sayıları ve gerekçeleri [bench/packs/CANDIDATES.md](bench/packs/CANDIDATES.md) içinde.

## Ölçüm

Bir linter boş yere uyarırsa kaldırılır, o yüzden yanlış uyarı maliyeti iddia değil ölçüm
olarak duruyor. `bench/corpus` içinde on metin var: dil modelleri ortaya çıkmadan önce yazılmış
beş metin (Austen 1813, Douglass 1845, Darwin 1859, PEP 8 ve PEP 257) ve düzeltilmemiş beş model
çıktısı. `npm run bench` her kuralı ikisinin üzerinde çalıştırıp
[`bench/PRECISION.md`](bench/PRECISION.md) dosyasını yazar; tablo eskirse CI kırılır.

İnsan metinleri A veya B alıyor, model çıktıları F. İlk koşu bir kuralın hatalı olduğunu
gösterdi: `curly-quotes` *Pride and Prejudice* bölümünde 92 satır işaretliyordu, model
çıktısında ise hiç. Kıvrık tırnak tipografidir; asıl iz, dosyanın kıvrık ve düz tırnağı
karıştırmasıdır. Kural artık yalnızca karışık dosyada konuşuyor.

## Bunu neden yaptığını anlat

`slop --explain <kural>` bir kuralı dört parçayla anlatır: neden makine izi sayılır, kuralı
tetikleyen bir satır, aynı satırın düzeltilmiş hali ve kuralı kapatmanın doğru olduğu durum.
`slop --init` başlangıç `.slop.json` dosyasını, `--init action` CI tanımını, `--init hook`
commit kancasını yazar. `.slop.json` içindeki `overrides` ile her yol için ayrı kural ve puan
sınırı verilebilir.

## Kendi yazılarımızda

5 Eylül 2026'da yazarın beş README'si ve sitesindeki on bir denemede çalıştırıldı:
ilk koşuda dört README A, product-engineer README C (kural listesi tam olarak `bold-label`
kuralının yakaladığı kalıpta yazılmıştı), on bir denemenin tümü A. Aynı gün o README
aracı önce gösterip sonra anlatacak biçimde yeniden yazıldı ve kural listesi düz cümleye
döndü; linter için düzenlenmedi, yeni koşuda A (0). Bulgular ve ilk skorlar İngilizce
[docs/OWN-WRITING.md](docs/OWN-WRITING.md) içinde.

## Gösteremedikleri

- Yazarlık. `Delve` yazan bir insan da modelle aynı bulguyu alır.
- Anlam. Listedeki her ifadeden kaçınan boş bir paragrafı iyisinden ayıramaz.
- Listenin dışındaki üslup. Farklı bir izi olan yazar geçer; bulunca kural ekleyin.
- Diğer diller. Kelime kuralları İngilizce; yapısal olanlar her dilde çalışır. `dash` ve `title-case-heading` İngilizce dışında durur. Fransızca için geçici bir kural var; İspanyolca ve Almanca için kural yok, çünkü hiçbir aday kabul sınırını geçmedi, bu yüzden bu dillerde model metnini tespit ettiğimizi iddia etmiyoruz. İkinci dil kural setleri [yol haritasında](ROADMAP.md).

## Atıf

Her sürüm Zenodo'da bir DOI ile arşivleniyor, böylece bir makale ya da rapor tam olarak
çalıştırdığı kural kümesine işaret edebiliyor. Burada bu, çoğu araçtan daha önemli: kurallar
değişiyor, yani sürümü söylenmeden verilen bir bulgu oranı tekrar edilebilir değil.

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.22396875.svg)](https://doi.org/10.5281/zenodo.22396875)

Bu **kavram** DOI'si: her zaman en yeni sürüme çözümlenir. Çalıştırdığınız sürümü atıflamak için
o sayfada yan çubuktan sürümü seçin. Depodaki `CITATION.cff` aynı tanımlayıcıyı taşıyor.

## Lisans

MIT.
