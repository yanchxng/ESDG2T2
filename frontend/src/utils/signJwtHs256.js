const enc = new TextEncoder()

function base64UrlEncode(bytes) {
  let bin = ''
  const u8 = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlEncodeJson(obj) {
  return base64UrlEncode(enc.encode(JSON.stringify(obj)))
}

export async function signJwtHs256(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' }
  const headerPart = base64UrlEncodeJson(header)
  const payloadPart = base64UrlEncodeJson(payload)
  const data = enc.encode(`${headerPart}.${payloadPart}`)
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sigBuf = await crypto.subtle.sign('HMAC', key, data)
  const sigPart = base64UrlEncode(new Uint8Array(sigBuf))
  return `${headerPart}.${payloadPart}.${sigPart}`
}
