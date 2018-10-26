import { browser, by, element } from 'protractor';
import { SitePage } from './site.po';

describe(browser.baseUrl, () => {
  const page = new SitePage();
  const getCurrentUrl = () =>
    browser
      .getCurrentUrl()
      .then(stripQuery)
      .then(stripTrailingSlash);
  const stripQuery = (url: string) => url.replace(/\?.*$/, '');
  const stripTrailingSlash = (url: string) => url.replace(/\/$/, '');

  beforeAll(done => page.init().then(done));

  beforeEach(() => browser.waitForAngularEnabled(false));
  afterEach(() => browser.waitForAngularEnabled(true));

  describe('(with sitemap URLs)', () => {
    page.sitemapUrls.forEach((path, i) => {
      it(`should not redirect '${path}' (${i + 1}/${
        page.sitemapUrls.length
      })`, async () => {
        await page.goTo(path);

        const expectedUrl = stripTrailingSlash(page.baseUrl + path);
        const actualUrl = await getCurrentUrl();

        expect(actualUrl).toBe(expectedUrl);
      });
    });
  });

  describe('(with legacy URLs)', () => {
    page.legacyUrls.forEach(([fromUrl, toUrl], i) => {
      it(`should redirect '${fromUrl}' to '${toUrl}' (${i + 1}/${
        page.legacyUrls.length
      })`, async () => {
        await page.goTo(fromUrl);

        const expectedUrl = stripTrailingSlash(
          /^http/.test(toUrl) ? toUrl : page.baseUrl + toUrl
        );
        const actualUrl = await getCurrentUrl();

        expect(actualUrl).toBe(expectedUrl);
      });
    });
  });

  describe('(with `.html` URLs)', () => {
    ['/path/to/file.html', '/top-level-file.html'].forEach(fromPath => {
      const toPath = fromPath.replace(/\.html$/, '');
      it(`should redirect '${fromPath}' to '${toPath}'`, async () => {
        await page.goTo(fromPath);

        const expectedUrl = page.baseUrl + toPath;
        const actualUrl = await getCurrentUrl();

        expect(actualUrl).toBe(expectedUrl);
      });
    });
  });

  describe('(with unknown URLs)', () => {
    const unknownPagePath = '/unknown/page';
    const unknownResourcePath = '/unknown/resource.ext';

    it('should serve `index.html` for unknown pages', async () => {
      const aioShell = element(by.css('aio-shell'));
      const heading = aioShell.element(by.css('h1'));
      await page.goTo(unknownPagePath);

      expect(aioShell.isPresent()).toBe(true);
      expect(heading.getText()).toMatch(/page not found/i);
    });

    it('should serve a custom 404 page for unknown resources', async () => {
      const aioShell = element(by.css('aio-shell'));
      const heading = aioShell.element(by.css('h1'));
      await page.goTo(unknownResourcePath);

      expect(aioShell.isPresent()).toBe(true);
      expect(heading.getText()).toMatch(/resource not found/i);
    });

    it('should include a link to the home page in custom 404 page', async () => {
      const homeNavLink = element(by.css('.nav-link.home'));
      await page.goTo(unknownResourcePath);

      expect(homeNavLink.isPresent()).toBe(true);

      await homeNavLink.click();
      const expectedUrl = page.baseUrl;
      const actualUrl = await getCurrentUrl();

      expect(actualUrl).toBe(expectedUrl);
    });
  });
});
