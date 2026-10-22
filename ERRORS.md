# XCap error codes / รหัส Error ของ XCap

The extension popup shows these codes instead of HTTP status codes. The code
stays on screen until something replaces it, so it can be looked up here.

popup ของ extension จะแสดงรหัสเหล่านี้แทนรหัส HTTP อย่าง 404 หรือ 403
รหัสจะค้างอยู่บนหน้าจอจนกว่าจะมีข้อความใหม่มาแทน เพื่อให้เปิดดูความหมายในไฟล์นี้ได้

The messages, in English and Thai, live in `STRINGS` in `public/xcap-extension/popup.js`. Keep the two
in step.

ข้อความของแต่ละรหัส ทั้งไทยและอังกฤษ อยู่ที่ `STRINGS` ใน `public/xcap-extension/popup.js`
ถ้าแก้ที่หนึ่ง ต้องแก้อีกที่ให้ตรงกันด้วย

## Format / รูปแบบ

`XC-` followed by three digits. The first digit is the category.

`XC-` ตามด้วยเลข 3 หลัก หลักแรกบอกหมวด

| Range | Category | หมวด |
|---|---|---|
| `XC-1xx` | Page and tab | หน้าเว็บและแท็บ |
| `XC-2xx` | Results (reserved) | ผลลัพธ์ (สงวนไว้) |
| `XC-3xx` | Settings | การตั้งค่า |

## Codes / รายการรหัส

### XC-101 · Not a supported page

**When:** the active tab is not on `dexscreener.com` or `coinmarketcap.com`.
The Scan button is disabled as soon as the popup opens.
**Fix:** open a DexScreener pool or a CoinMarketCap coin, then open the popup again.

**เกิดเมื่อ:** แท็บที่เปิดอยู่ไม่ใช่ `dexscreener.com` หรือ `coinmarketcap.com`
ปุ่ม Scan จะถูกปิดตั้งแต่เปิด popup
**แก้:** เปิดหน้า pool ของ DexScreener หรือหน้าเหรียญของ CoinMarketCap แล้วเปิด popup ใหม่

### XC-102 · Reload the tab, then Scan

**When:** the site is supported, but the capture script is not running in
the tab. This happens when the tab was opened before the extension was
installed or reloaded.
**Fix:** reload the tab, then press Scan again.

**เกิดเมื่อ:** เว็บเป็นเว็บที่รองรับ แต่ script ดักข้อมูลไม่ได้ทำงานอยู่ในแท็บ
มักเกิดเมื่อแท็บเปิดไว้ก่อนติดตั้งหรือ reload extension
**แก้:** รีเฟรชแท็บ แล้วกด Scan อีกครั้ง

### XC-103 · No active tab

**When:** Chrome reports no active tab in the current window.
**Fix:** click into a browser tab, then open the popup again.

**เกิดเมื่อ:** Chrome หาแท็บที่ใช้งานอยู่ในหน้าต่างปัจจุบันไม่เจอ
**แก้:** คลิกที่แท็บใดแท็บหนึ่ง แล้วเปิด popup ใหม่

### XC-301 · Save failed

**When:** Chrome refused to write the settings to extension storage.
**Fix:** try Save again. If it keeps failing, reload the extension at
`chrome://extensions`.

**เกิดเมื่อ:** Chrome บันทึกการตั้งค่าลง storage ของ extension ไม่สำเร็จ
**แก้:** กด Save อีกครั้ง ถ้ายังไม่ได้ ให้ reload extension ที่ `chrome://extensions`
