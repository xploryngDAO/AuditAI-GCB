import test from "node:test";
import assert from "node:assert/strict";
import { isValidCnpjDigits, isValidCpfDigits, maskCustomerName, maskPII } from "../src/utils/piiMasking.ts";

test("mascara nomes com partículas (da/de/do/das/dos) — LGPD", () => {
  const name = "Graciete Miguel Da Silva Barbosa";
  const masked = maskCustomerName(name);
  assert.notEqual(masked, name);
  assert.match(masked, /^Graciete /);
  assert.match(masked, /S\*/);

  const tagged = maskPII("[CLIENTE - Graciete Miguel Da Silva Barbosa]: olá").maskedText;
  assert.doesNotMatch(tagged, /Barbosa/);
});

test("mascara nome falado no meio do diálogo", () => {
  const masked = maskPII("meu nome é Graciete Miguel Da Silva Barbosa, tudo bem?").maskedText;
  assert.doesNotMatch(masked, /Barbosa/);
});

test("mascara CPF solto apenas quando os dígitos verificadores são válidos", () => {
  const valid = maskPII("meu cpf é 11144477735").maskedText;
  assert.match(valid, /111\.\*\*\*\.\*\*\*-35/);

  // Número de protocolo de 11 dígitos (inválido como CPF) é preservado.
  const protocolLike = maskPII("pedido 12345678901").maskedText;
  assert.match(protocolLike, /12345678901/);
});

test("mascara CNPJ solto válido", () => {
  const masked = maskPII("cnpj 11222333000181").maskedText;
  assert.match(masked, /11\.\*\*\*\.\*\*\*\/0001-81/);
});

test("valida dígitos verificadores de CPF/CNPJ", () => {
  assert.equal(isValidCpfDigits("11144477735"), true);
  assert.equal(isValidCpfDigits("111.444.777-35"), true);
  assert.equal(isValidCpfDigits("12345678901"), false);
  assert.equal(isValidCnpjDigits("11222333000181"), true);
  assert.equal(isValidCnpjDigits("11222333000180"), false);
});

test("mascara PAN com pontos/espaços, e-mail, telefone e segredo", () => {
  const pan = maskPII("cartão 4532.1234.5678.9012").maskedText;
  assert.match(pan, /4532 \*\*\*\* \*\*\*\* 9012/);

  const email = maskPII("fale com joao.silva@empresa.com").maskedText;
  assert.match(email, /jo\*\*\*\*@empresa\.com/);

  const phone = maskPII("telefone (11) 98765-4321").maskedText;
  assert.match(phone, /\(11\) 9\*\*\*\*-4321/);

  const secret = maskPII("a senha é Abc@123 por favor").maskedText;
  assert.doesNotMatch(secret, /Abc@123/);
});

test("protocolo e timestamps são protegidos de falso mascaramento", () => {
  const text = "[00:15] [Atendente]: o protocolo 20260724912 e o pedido 489201948";
  const masked = maskPII(text).maskedText;
  assert.match(masked, /20260724912/);
  assert.match(masked, /489201948/);
  assert.match(masked, /\[00:15\]/);
});

test("mascaramento é idempotente", () => {
  const input = "[CLIENTE - Mariana Lopes]: CPF 111.444.777-35, tel (11) 98765-4321, email mariana@teste.com";
  const once = maskPII(input).maskedText;
  const twice = maskPII(once).maskedText;
  assert.equal(once, twice);
});

test("mascara endereço, dados bancários, nascimento e cliente em linha 'Cliente: Nome'", () => {
  const address = maskPII("moro na Avenida Paulista 1578, apto 42").maskedText;
  assert.doesNotMatch(address, /Paulista 1578/);

  const bank = maskPII("agência 1234 conta 98765432").maskedText;
  assert.doesNotMatch(bank, /98765432/);

  const birth = maskPII("nasci em 15/04/1988").maskedText;
  assert.doesNotMatch(birth, /15\/04\/1988/);

  const colon = maskPII("Cliente: Mariana Lopes").maskedText;
  assert.doesNotMatch(colon, /Lopes/);
});

test("mascara nome citado em 'em nome de' e 'falei com'", () => {
  const a = maskPII("ligo em nome de Graciete Miguel").maskedText;
  assert.doesNotMatch(a, /Miguel/);

  const b = maskPII("falei com Mariana Lopes agora").maskedText;
  assert.doesNotMatch(b, /Lopes/);
});
