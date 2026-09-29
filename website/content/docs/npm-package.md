> **Planned, not published yet.** This page describes the direction for a `devfiller` npm package. Names and APIs below are a draft and will change. [Tell us what you need](https://github.com/gouderhaithem/form-filler/issues) before it's built.

## Why a package

The extension saves typing when you test by hand. Automated tests have the same problem: sign-up and checkout tests end up full of hard-coded strings like `test@test.com` that never change and never find the bugs real data would.

The package would bring the extension's engine to your test suite as a dev dependency:

```sh
npm install --save-dev devfiller
```

## What it would do

- **Generate data**: the same coherent identities, addresses, numbers and dates as the extension, in English, French or Arabic, with no network access.
- **Fill a form**: the same field detection, so one call fills a whole form in a Playwright or Cypress test, with the same skip rules for passwords, payments and consent.
- **Repeat a run**: an optional seed, so a failing test produces the same data every time you rerun it.
- **Report what happened**: which fields were filled or skipped, and why, for your assertions.

## Draft API

Generate data in any test runner:

```ts
import { generate } from "devfiller";

const person = generate({ locale: "fr", seed: 42 });
// { firstName: "Marie", lastName: "…", email: "…@example.com", city: "…", … }
```

Fill a page in a Playwright test:

```ts
import { test, expect } from "@playwright/test";
import { fill } from "devfiller/playwright";

test("sign-up accepts realistic data", async ({ page }) => {
  await page.goto("/signup");
  const result = await fill(page, { locale: "en", exclude: ["#promo-code"] });
  expect(result.skipped).toEqual([]);
  await page.getByRole("button", { name: "Create account" }).click();
});
```

## Status

The extension's generator and field detection already exist and are covered by tests. The work left is packaging them without the browser-extension parts, designing the API above, and adding adapters for Playwright and Cypress. Follow progress on the [roadmap](/#roadmap).
