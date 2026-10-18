"""Headless WebGL test: new game -> overworld -> walk to Rival 1 -> in-world battle (auto) -> Secret Power -> result -> back to world.
python3 test3d.py [base_url]"""
import asyncio, sys, json, time
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8123/'
OUT = '/workspace/sloppy-pals/screens3d/'
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
log = []
def L(*a): s = ' '.join(str(x) for x in a); print(s, flush=True); log.append(s)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS)
        pg = await b.new_page(viewport={'width': 1280, 'height': 720})
        errs = []
        pg.on('console', lambda m: errs.append(m.type + ': ' + m.text) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
        t0 = time.time()
        await pg.goto(BASE + '?test=1&fast=1&auto=1')
        await pg.evaluate('localStorage.clear()')
        await pg.wait_for_function('window.__T && __T.mode()==="menu"', timeout=120000)
        L('loaded in %.1fs' % (time.time() - t0))
        await pg.click('[data-r=new]'); await pg.click('[data-s=random]'); await pg.click('#modal .pick')
        await pg.wait_for_function('__T.mode()==="world"', timeout=20000)
        save = await pg.evaluate('__T.save()'); L('starter team', save['team'], 'cmdr', save['cmdr'])
        await pg.wait_for_timeout(2500)
        await pg.screenshot(path=OUT + '01_overworld_town.png')
        # a scenic overworld shot near the bog / grove
        await pg.evaluate('__T.freeze(true); __T.teleport(-38, 16, -2.2)'); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=OUT + '02_overworld_bog.png')
        await pg.evaluate('__T.teleport(-46, -38, 0.6)'); await pg.wait_for_timeout(2500)
        await pg.screenshot(path=OUT + '03_overworld_grove.png')
        # walk to Rival 1 (Cousin Dan) for real: hold W toward him
        sp = await pg.evaluate('__T.spawnOf("rival1")'); L('rival1 at', sp)
        await pg.evaluate(f'__T.teleport({sp["x"]}, {sp["z"] + 14}, Math.PI); __T.faceTo({sp["x"]}, {sp["z"]}); __T.freeze(false)')
        await pg.wait_for_timeout(300)
        await pg.keyboard.down('w')
        walked = False
        for i in range(60):
            await pg.wait_for_timeout(200)
            m = await pg.evaluate('__T.mode()')
            if m != 'world': walked = True; break
        await pg.keyboard.up('w')
        L('encounter triggered by walking:', walked, 'mode', await pg.evaluate('__T.mode()'), 'player', await pg.evaluate('__T.pos()'))
        # rival intro dialog
        await pg.wait_for_selector('#modal [data-n]', timeout=15000); await pg.wait_for_timeout(400)
        await pg.screenshot(path=OUT + '04_rival_spotted_dialog.png'); await pg.click('#modal [data-n]')
        await pg.wait_for_selector('#bhud.on', timeout=30000)
        await pg.wait_for_timeout(2200)
        await pg.screenshot(path=OUT + '05_battle_in_world.png')
        # give the player's side full rage so a Secret Power fires
        await pg.evaluate('__T.speed(1); __T.rage(0)')
        sp_shot = False
        for i in range(300):
            await pg.wait_for_timeout(100)
            if await pg.evaluate('document.getElementById("spBanner").className==="show"'):
                await pg.wait_for_timeout(750); await pg.screenshot(path=OUT + '06_secret_power.png'); sp_shot = True; await pg.evaluate('__T.speed(0.25)'); break
            if i % 30 == 29: await pg.evaluate('__T.rage(0)')
        L('secret power moment captured:', sp_shot)
        mid = False
        for i in range(600):
            await pg.wait_for_timeout(250)
            if not mid and i == 12: await pg.screenshot(path=OUT + '07_battle_midfight.png'); mid = True
            if await pg.evaluate('!!document.querySelector("#modal.result")'): break
        res = await pg.evaluate('window.__lastResult'); g = await pg.evaluate('(()=>{const G=__T.battle();return G&&{turns:G.turns,winner:G.winner,log:G.log.length}})()')
        L('battle result', res, g)
        await pg.screenshot(path=OUT + '08_battle_result.png')
        for i in range(12):
            if await pg.evaluate('__T.mode()') == 'world': break
            await pg.evaluate('__T.clickResult()'); await pg.wait_for_timeout(700)
        await pg.wait_for_function('__T.mode()==="world"', timeout=20000)
        await pg.wait_for_timeout(1500)
        s2 = await pg.evaluate('__T.save()'); L('after battle: badges', s2['badges'], 'collection', len(s2['collection']), 'cmdrs', s2['cmdrs'])
        await pg.screenshot(path=OUT + '09_back_in_world.png')
        # wild Pal encounter: walk into the nearest wild Pal
        await pg.evaluate('__T.freeze(true)')
        pt = await pg.evaluate('window.__app.world.L.patches[8]')
        await pg.evaluate(f'__T.teleport({pt["x"]}, {pt["z"] + 9}, Math.PI)'); await pg.wait_for_timeout(2500)
        wl = await pg.evaluate('__T.wildsNear()'); L('wild pals loaded', len(wl))
        near = min(wl, key=lambda w: (w['p'][0] - pt['x']) ** 2 + (w['p'][2] - pt['z']) ** 2) if wl else None
        if near:
            await pg.evaluate(f'__T.teleport({near["p"][0]}, {near["p"][2] + 5}, Math.PI); __T.faceTo({near["p"][0]}, {near["p"][2]})'); await pg.wait_for_timeout(1200)
            await pg.screenshot(path=OUT + '10_wild_pal_in_slop_grass.png')
            await pg.evaluate('__T.freeze(false)')
            for i in range(80):
                w = await pg.evaluate('__T.wildsNear()'); m = await pg.evaluate('__T.mode()')
                if m != 'world': break
                if w:
                    q = min(w, key=lambda w: (w['p'][0] - near['p'][0]) ** 2 + (w['p'][2] - near['p'][2]) ** 2)
                    await pg.evaluate(f'__T.faceTo({q["p"][0]}, {q["p"][2]})')
                await pg.keyboard.down('w'); await pg.wait_for_timeout(150)
            await pg.keyboard.up('w')
            L('wild encounter mode', await pg.evaluate('__T.mode()'))
            await pg.wait_for_selector('#bhud.on', timeout=30000); await pg.wait_for_timeout(2500)
            await pg.screenshot(path=OUT + '11_wild_battle.png')
            for i in range(600):
                await pg.wait_for_timeout(250)
                if await pg.evaluate('!!document.querySelector("#modal.result")'): break
            L('wild result', await pg.evaluate('window.__lastResult'))
            await pg.screenshot(path=OUT + '12_wild_result.png')
            for i in range(12):
                if await pg.evaluate('__T.mode()') == 'world': break
                await pg.evaluate('__T.clickResult()'); await pg.wait_for_timeout(700)
            await pg.wait_for_function('__T.mode()==="world"', timeout=20000)
            s3 = await pg.evaluate('__T.save()'); L('after wild: collection', len(s3['collection']))
        # reload -> Continue from save
        await pg.reload(); await pg.wait_for_function('window.__T && __T.mode()==="menu"', timeout=120000)
        has_cont = await pg.evaluate('!!document.querySelector("[data-r=continue]")'); L('save persisted (Continue button):', has_cont)
        L('CONSOLE ERRORS', len(errs), json.dumps(errs[:10]))
        L('page __errors', await pg.evaluate('window.__errors'))
        open(OUT + 'test_log.txt', 'w').write('\n'.join(log))
        await b.close()
asyncio.run(main())
