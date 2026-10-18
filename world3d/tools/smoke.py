import asyncio, sys, json
from playwright.async_api import async_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/?test=1&fast=1&auto=1'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        pg = await b.new_page(viewport={'width': 1280, 'height': 720})
        errs = []
        pg.on('console', lambda m: errs.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
        await pg.goto(URL)
        await pg.wait_for_function('window.__T && __T.mode()==="menu"', timeout=90000)
        await pg.wait_for_timeout(1500)
        await pg.screenshot(path='/tmp/s_title.png')
        print('ERRS', json.dumps(errs[:20], indent=0))
        await b.close()
asyncio.run(main())
