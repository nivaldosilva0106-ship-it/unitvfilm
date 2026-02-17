import { app, BrowserWindow } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─ dist
// │ ├─- index.html
// │ ├─- assets
// │ └─- ...
// ├─┬─ dist-electron
// │ ├─- main.js
// │ └─- preload.js
//
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

const AD_BLOCK_LIST = [
    '*://*.doubleclick.net/*',
    '*://*.google-analytics.com/*',
    '*://*.googlesyndication.com/*',
    '*://*.googleadservices.com/*',
    '*://*.googletagmanager.com/*',
    '*://*.googletagservices.com/*',
    '*://*.ads.google.com/*',
    '*://alert-system.com/*',
    '*://*.popads.net/*',
    '*://*.popcash.net/*',
    '*://*.onclickads.net/*',
    '*://*.propellerads.com/*',
    '*://*.adnxs.com/*',
    '*://*.mobicow.com/*',
    '*://*.ad-maven.com/*',
    '*://*.exoclick.com/*',
    '*://*.hdtvlogo.com/*',
    '*://*.vidoza.net/*',
    '*://*.fembed.net/*',
    '*://*.embed.im/*',
    '*://*.realsrv.com/*',
    '*://*.juicyads.com/*',
    '*://*.ero-advertising.com/*',
    '*://*.blacklabelads.com/*',
    '*://*.exosrv.com/*',
    '*://*.clicknupload.org/*',
    '*://*.pdiscan.com/*',
    '*://*.yandex.ru/*',
    '*://*.taboola.com/*',
    '*://*.outbrain.com/*',
    '*://*.mgr.consensu.org/*',
    '*://*.sibbo.net/*',
    '*://*.quantserve.com/*',
    '*://*.scorecardresearch.com/*',
    '*://*.casalemedia.com/*',
    '*://*.rubiconproject.com/*',
    '*://*.pubmatic.com/*',
    '*://*.openx.net/*',
    '*://*.advertising.com/*',
    '*://*.bidswitch.net/*',
    '*://*.criteo.com/*',
    '*://*.smartadserver.com/*',
    '*://*.yieldmo.com/*',
    '*://*.lijit.com/*',
    '*://*.mpx.mparticle.com/*',
    '*://*.krxd.net/*',
    '*://*.bluekai.com/*',
    '*://*.dotomi.com/*',
    '*://*.mathtag.com/*',
    '*://*.agkn.com/*',
    '*://*.rfihub.com/*',
    '*://*.tapad.com/*',
    '*://*.demdex.net/*',
    '*://*.rlcdn.com/*',
    '*://*.turn.com/*',
    '*://*.adnxs.com/*',
    '*://*.gwallet.com/*',
    '*://*.simpli.fi/*',
    '*://*.chango.com/*',
    '*://*.rocketfuel.com/*',
    '*://*.adroll.com/*',
    '*://*.perfectmarket.com/*',
    '*://*.sitescout.com/*',
    '*://*.acuityads.com/*',
    '*://*.adhigh.net/*',
    '*://*.adform.net/*',
    '*://*.adriver.ru/*',
    '*://*.adtech.de/*',
    '*://*.adtruth.com/*',
    '*://*.aerServ.com/*',
    '*://*.akamai.com/*',
    '*://*.appier.com/*',
    '*://*.appnexus.com/*',
    '*://*.atdmt.com/*',
    '*://*.attentivemobile.com/*',
    '*://*.audienceanywhere.com/*',
    '*://*.aunic.net/*',
    '*://*.avocet.io/*',
    '*://*.bazaarvoice.com/*',
    '*://*.betrad.com/*',
    '*://*.bizgraphics.com/*',
    '*://*.bloomreach.com/*',
    '*://*.bounceexchange.com/*',
    '*://*.brandwatch.com/*',
    '*://*.brightcove.com/*',
    '*://*.bugsense.com/*',
    '*://*.cartstack.com/*',
    '*://*.chartbeat.com/*',
    '*://*.clickcease.com/*',
    '*://*.clicktale.com/*',
    '*://*.cloud.google.com/*',
    '*://*.cloudflare.com/*',
    '*://*.comscore.com/*',
    '*://*.conjoint.ly/*',
    '*://*.contextads.live/*',
    '*://*.conversantmedia.com/*',
    '*://*.crazyegg.com/*',
    '*://*.datadoghq.com/*',
    '*://*.dataxu.com/*',
    '*://*.delacon.com/*',
    '*://*.demandbase.com/*',
    '*://*.di2.nu/*',
    '*://*.dialogtech.com/*',
    '*://*.digitalriver.com/*',
    '*://*.directrev.com/*',
    '*://*.disqus.com/*',
    '*://*.doubleverify.com/*',
    '*://*.drip.com/*',
    '*://*.dynatrace.com/*',
    '*://*.dynamic yield.com/*',
    '*://*.earthli.com/*',
    '*://*.effectivemeasure.net/*',
    '*://*.eluminate.net/*',
    '*://*.eloqua.com/*',
    '*://*.embluejet.com/*',
    '*://*.ensighten.com/*',
    '*://*.epsilon.com/*',
    '*://*.estat.com/*',
    '*://*.etoro.com/*',
    '*://*.eulerian.com/*',
    '*://*.evidon.com/*',
    '*://*.exelator.com/*',
    '*://*.exponential.com/*',
    '*://*.eyeviewdigital.com/*',
    '*://*.facebook.com/*',
    '*://*.fct.li/*',
    '*://*.flashtalking.com/*',
    '*://*.flexn.com/*',
    '*://*.foresee.com/*',
    '*://*.fullstory.com/*',
    '*://*.gaiam.com/*',
    '*://*.ganymede.tv/*',
    '*://*.getclicky.com/*',
    '*://*.glot.io/*',
    '*://*.go-mp.com/*',
    '*://*.gomp.com/*',
    '*://*.google.com/ads/*',
    '*://*.googlesyndication.com/*',
    '*://*.grapeshot.co.uk/*',
    '*://*.gravity.com/*',
    '*://*.grid.ai/*',
    '*://*.gs-mktg.com/*',
    '*://*.gumgum.com/*',
    '*://*.hagale.net/*',
    '*://*.healthline.com/*',
    '*://*.hellobar.com/*',
    '*://*.hi-rez.com/*',
    '*://*.hi.com/*',
    '*://*.himaya.com/*',
    '*://*.hotjar.com/*',
    '*://*.hubspot.com/*',
    '*://*.hurryload.to/*',
    '*://*.imrworldwide.com/*',
    '*://*.incisivemedia.com/*',
    '*://*.indexww.com/*',
    '*://*.infusionsoft.com/*',
    '*://*.inner-active.com/*',
    '*://*.insight.ly/*',
    '*://*.inskinad.com/*',
    '*://*.intentiq.com/*',
    '*://*.intercom.io/*',
    '*://*.involver.com/*',
    '*://*.iodata.com/*',
    '*://*.ipecorp.com/*',
    '*://*.iprospect.com/*',
    '*://*.iqcast.mobi/*',
    '*://*.itunes.apple.com/*',
    '*://*.jalbum.net/*',
    '*://*.jivox.com/*',
    '*://*.js-agent.newrelic.com/*',
    '*://*.klaviyo.com/*',
    '*://*.koan.ai/*',
    '*://*.kochava.com/*',
    '*://*.lendingtree.com/*',
    '*://*.linksynergy.com/*',
    '*://*.list-manage.com/*',
    '*://*.liadm.com/*',
    '*://*.livechatinc.com/*',
    '*://*.livedoor.jp/*',
    '*://*.liveramp.com/*',
    '*://*.lovelabs.com/*',
    '*://*.luckyorange.com/*',
    '*://*.lytics.io/*',
    '*://*.madmimi.com/*',
    '*://*.magnite.com/*',
    '*://*.mailchimp.com/*',
    '*://*.marketo.com/*',
    '*://*.marfeel.com/*',
    '*://*.maxymiser.com/*',
    '*://*.mediamath.com/*',
    '*://*.mediaplex.com/*',
    '*://*.mixpanel.com/*',
    '*://*.mng-ads.com/*',
    '*://*.moatads.com/*',
    '*://*.monetate.net/*',
    '*://*.mouseflow.com/*',
    '*://*.mparticle.com/*',
    '*://*.mrtn.net/*',
    '*://*.mxptint.net/*',
    '*://*.nanigans.com/*',
    '*://*.narrative.io/*',
    '*://*.navdmp.com/*',
    '*://*.netmng.com/*',
    '*://*.newrelic.com/*',
    '*://*.nexac.com/*',
    '*://*.nielsen.com/*',
    '*://*.notify.me/*',
    '*://*.npttech.com/*',
    '*://*.nr-data.net/*',
    '*://*.octobat.com/*',
    '*://*.offerpath.com/*',
    '*://*.omniture.com/*',
    '*://*.onmousestat.com/*',
    '*://*.optimizely.com/*',
    '*://*.org-mktg.com/*',
    '*://*.outbound.io/*',
    '*://*.owner-mktg.com/*',
    '*://*.owneriq.com/*',
    '*://*.p-n.io/*',
    '*://*.p-n.me/*',
    '*://*.p-n.net/*',
    '*://*.p-n.org/*',
    '*://*.pageguide.com/*',
    '*://*.parsely.com/*',
    '*://*.perfectaudience.com/*',
    '*://*.performable.com/*',
    '*://*.permutive.com/*',
    '*://*.persado.com/*',
    '*://*.phos.js/*',
    '*://*.piwik.org/*',
    '*://*.placeiq.com/*',
    '*://*.popads.net/*',
    '*://*.popcash.net/*',
    '*://*.postrelease.com/*',
    '*://*.precise.io/*',
    '*://*.proads.net/*',
    '*://*.proximic.com/*',
    '*://*.qualtrics.com/*',
    '*://*.quantcast.com/*',
    '*://*.raas.io/*',
    '*://*.rader.io/*',
    '*://*.rakuten.com/*',
    '*://*.rambler.ru/*',
    '*://*.recaptcha.net/*',
    '*://*.refinedads.com/*',
    '*://*.remix.mobi/*',
    '*://*.responsys.com/*',
    '*://*.revjet.com/*',
    '*://*.rfihub.com/*',
    '*://*.richrelevance.com/*',
    '*://*.rlcdn.com/*',
    '*://*.rtmark.net/*',
    '*://*.rubiconproject.com/*',
    '*://*.sail-mktg.com/*',
    '*://*.sailthru.com/*',
    '*://*.salesforce.com/*',
    '*://*.segment.com/*',
    '*://*.serving-sys.com/*',
    '*://*.sharethrough.com/*',
    '*://*.shofree.com/*',
    '*://*.siid.fm/*',
    '*://*.similarweb.com/*',
    '*://*.simpli.fi/*',
    '*://*.sitemeter.com/*',
    '*://*.sitescout.com/*',
    '*://*.skimlinks.com/*',
    '*://*.smartadserver.com/*',
    '*://*.smartsheet.com/*',
    '*://*.snigel.com/*',
    '*://*.sociomantic.com/*',
    '*://*.sojern.com/*',
    '*://*.sparkpost.com/*',
    '*://*.statcounter.com/*',
    '*://*.sumome.com/*',
    '*://*.swiftype.com/*',
    '*://*.t.contentserver.org/*',
    '*://*.tailtarget.com/*',
    '*://*.tapad.com/*',
    '*://*.target.com/*',
    '*://*.teads.tv/*',
    '*://*.tealiumiq.com/*',
    '*://*.teamaffiliate.com/*',
    '*://*.telemetry.js/*',
    '*://*.telescope.js/*',
    '*://*.thebrighttag.com/*',
    '*://*.themonetizr.com/*',
    '*://*.tidaltv.com/*',
    '*://*.trackvol.com/*',
    '*://*.tremorhub.com/*',
    '*://*.tritondigital.com/*',
    '*://*.trustarc.com/*',
    '*://*.truthseeker.se/*',
    '*://*.tui.com/*',
    '*://*.turn.com/*',
    '*://*.tv-mktg.com/*',
    '*://*.ubimo.com/*',
    '*://*.undertone.com/*',
    '*://*.unidm.ru/*',
    '*://*.unrulymedia.com/*',
    '*://*.upgather.com/*',
    '*://*.uplandsoftware.com/*',
    '*://*.uply.me/*',
    '*://*.user-mktg.com/*',
    '*://*.userreport.com/*',
    '*://*.vads.com/*',
    '*://*.veneree.com/*',
    '*://*.vibrantmedia.com/*',
    '*://*.vidora.com/*',
    '*://*.vignette.com/*',
    '*://*.vimple.ru/*',
    '*://*.visualdna.com/*',
    '*://*.vizury.com/*',
    '*://*.vntsm.com/*',
    '*://*.vserv.mobi/*',
    '*://*.vungle.com/*',
    '*://*.warmup.co.uk/*',
    '*://*.wearedigital.co.uk/*',
    '*://*.webtrends.com/*',
    '*://*.wishbi.com/*',
    '*://*.woopra.com/*',
    '*://*.wp.com/*',
    '*://*.wpsight.com/*',
    '*://*.wunderloop.net/*',
    '*://*.xaxis.com/*',
    '*://*.xiti.com/*',
    '*://*.yandex.net/*',
    '*://*.yandex.ru/*',
    '*://*.yieldmo.com/*',
    '*://*.yieldoptimizer.com/*',
    '*://*.zamano.com/*',
    '*://*.zdbb.net/*',
    '*://*.zedo.com/*',
    '*://*.zemanta.com/*',
    '*://*.zensight.ai/*',
    '*://*.zeotap.com/*',
    '*://*.zeus.ai/*',
    '*://*.ziggeo.com/*',
    '*://*.zopim.com/*',
    '*://*.zuora.com/*',
    '*://*.zynga.com/*',
];

let win: BrowserWindow | null
let adBlockEnabled = true;

function createWindow() {
    win = new BrowserWindow({
        icon: path.join(process.env.VITE_PUBLIC as string, 'electron-vite.svg'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            // Important for some embeds to work correctly while still being "blocked"
            nodeIntegration: false,
            contextIsolation: true,
        },
    })

    // AdBlocker request interceptor
    const session = win.webContents.session;
    session.webRequest.onBeforeRequest({ urls: AD_BLOCK_LIST }, (details: any, callback: any) => {
        if (adBlockEnabled) {
            console.log(`[AdBlock] Blocked: ${details.url}`);
            callback({ cancel: true });
        } else {
            callback({ cancel: false });
        }
    });

    // Global Popup Blocker
    win.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
        if (adBlockEnabled) {
            console.log(`[AdBlock] Prevented popup to: ${url}`);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });

    // Handle IPC to toggle ad-blocking
    const { ipcMain } = require('electron');
    ipcMain.on('toggle-adblock', (_event: any, enabled: boolean) => {
        adBlockEnabled = enabled;
        console.log(`[AdBlock] Status: ${adBlockEnabled ? 'Enabled' : 'Disabled'}`);
    });

    // Test active push message to Renderer-process.
    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', (new Date).toLocaleString())
    })

    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL)
    } else {
        // win.loadFile('dist/index.html')
        win.loadFile(path.join(RENDERER_DIST, 'index.html'))
    }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
        win = null
    }
})

app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

app.whenReady().then(createWindow)
