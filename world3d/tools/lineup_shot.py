import asyncio, sys
from playwright.async_api import async_playwright
OUT = '/workspace/sloppy-pals/screens3d/'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width': 1600, 'height': 1000}); errs = []
        pg.on('console', lambda m: m.type == 'error' and errs.append(m.text)); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:8123/lineup.html?still=1'); await pg.wait_for_function('window.__lineupReady || window.__lineupErr', timeout=120000)
        print('ready', await pg.evaluate('window.__lineupReady'), await pg.evaluate('window.__lineupErr||""'))
        await pg.wait_for_timeout(4000); await pg.screenshot(path=OUT + '14_pal_lineup_threejs.png', timeout=120000)
        print('errors', errs); await b.close()
asyncio.run(main())
