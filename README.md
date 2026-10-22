# Developer Command Center — standalone

Самостоятелна версия с оригиналния React интерфейс, premium дизайн, видеофон,
пулсиращо лого и четири запазващи се електрикови теми. Няма runtime зависимост
от ChatGPT, Sites, OAI headers, MCP или свързани ChatGPT задачи.

## Какво е необходимо

- Node.js 24 и pnpm 11.25.0.
- Твой GitHub акаунт за кода.
- Твой Cloudflare акаунт за Workers и D1. GitHub Pages не изпълнява този backend.
- GitHub/Vercel tokens, ако искаш тези интеграции.

Не са създавани ресурси или активирани платени услуги. Провери квотите на своя
план преди deployment. Съществуващият Site не се заменя от този архив.

## 1. Локално стартиране

```sh
pnpm install --frozen-lockfile
cp .dev.vars.example .dev.vars
pnpm password
```
Командата пита за парола със скрито въвеждане и отпечатва нейния PBKDF2 hash.
Постави целия hash като стойност на OWNER_PASSWORD_HASH в `.dev.vars`.
Генерирай master key за шифрованите интеграции:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```
Постави го като CREDENTIAL_ENCRYPTION_KEY в `.dev.vars`. Не го сменяй след запис
на tokens. Username е OWNER_USERNAME в wrangler.jsonc (по подразбиране admin).

```sh
pnpm db:local
pnpm dev
```
Отвори http://localhost:5173. APP_ORIGIN трябва да съвпада точно с origin-а.
По подразбиране е http://localhost:5173. За local preview на друг порт промени
APP_ORIGIN. Реалните `.dev.vars` и `.env` са изключени от Git.

## 2. Качване в GitHub

Разархивирай и влез в папката. Създай ново празно private repository в GitHub,
например `developer-command-center`. Отвори Terminal в тази папка:

```sh
git init
git add .
git commit -m "Standalone Developer Command Center"
git branch -M main
git remote add origin https://github.com/YOUR_USER/developer-command-center.git
git push -u origin main
```
Замени YOUR_USER. Качвай разархивирания код, не само ZIP. Провери `git status`
преди commit: не включвай secrets или локална база.

## 3. Публикуване в Cloudflare

```sh
pnpm exec wrangler login
pnpm exec wrangler d1 create developer-command-center
```
В `wrangler.jsonc` замени нулевия `database_id` с получения реален UUID.
Задай APP_ORIGIN на точния бъдещ HTTPS адрес, например
`https://developer-command-center.YOUR_SUBDOMAIN.workers.dev` или собствен домейн.
Username може да се промени чрез OWNER_USERNAME. Не включвай парола в JSON.

```sh
pnpm exec wrangler secret put OWNER_PASSWORD_HASH
pnpm exec wrangler secret put CREDENTIAL_ENCRYPTION_KEY
pnpm db:remote
pnpm deploy
```
При `secret put` постави стойността интерактивно; не я включвай в командата или
Git. Ако Wrangler пита за създаване на Worker, използвай името от конфигурацията.
Сайтът отказва достъп, когато няма конфигуриран password hash или origin.
След deployment отвори `/login`, влез и в Настройки добави GitHub/Vercel tokens.
Могат да бъдат зададени и като runtime secrets GITHUB_TOKEN и VERCEL_TOKEN.

## Защита и достъп

Един собственик; сесия 12 часа. В базата се съхранява само SHA-256 на случаен
256-bit session token. Cookie: HttpOnly, SameSite=Strict и Secure при HTTPS.
Промяна на password hash обезсилва старите сесии. Logout изтрива текущата сесия.
Login има постоянен лимит: 10 опита на IP за 15 минути и 100 общо за този период.
Mutations изискват съвпадащ Origin. Header-и, имитиращи външно удостоверяване,
не дават достъп. Backend endpoints, включително collect, са защитени.

## Независим фонов мониторинг

`triggers.crons` е `* * * * *`: всяка минута. Worker scheduled handler
извиква същия collector директно; браузър, Mac и ChatGPT не са необходими.
Dashboard показва графика активен след първото успешно cron изпълнение.
След deployment провери Cloudflare → Worker → Triggers/Cron Events. Реално
изпълнение в твоя акаунт не е потвърдено от този експорт.

## Данни и ограничения

- Нова D1 база започва с първоначалните сайтове и shortcuts.
- Текущата production история, личните настройки и tokens не са експортирани.
- При пренасяне на база не пренасяй стари credentials без същия encryption key;
  по-лесно ги въведи отново през Настройки.
- SSL expiry остава „Няма данни“, ако HTTP runtime не го предоставя.
- Alerts и графики се основават на реално записани проверки.
- Няма push известия при затворен браузър. Backend мониторингът продължава.
- Оригиналната SSRF защита е запазена за Cloudflare Workers. Не я прехвърляй
  механично на Node fetch без проверка и pinning на IP при свързване.
- Vinext е beta dependency, запазена с оригиналния lockfile. Не е извършен
  upgrade на framework dependencies.

## Проверки

```sh
pnpm typecheck
pnpm test
pnpm build
```
Потвърдени при подготовката: TypeScript, production build, 31 unit/backend теста,
включително login, session expiry, logout, spoofed headers, Origin, rate limit,
шифровани credentials, инциденти и извикване на collector от scheduled handler.
Тестовете на auth използват локална SQLite и изолиран handler, не жив Cloudflare
акаунт. Не е потвърден production deployment, реален cron или browser end-to-end
в твоя акаунт. Не е създадено GitHub repository вместо теб.

## Официални инструкции

- https://developers.cloudflare.com/workers/configuration/cron-triggers/
- https://developers.cloudflare.com/d1/reference/migrations/
- https://developers.cloudflare.com/workers/configuration/secrets/
