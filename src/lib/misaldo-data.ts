export type Role = "cliente" | "empleado" | "dueno" | "staff";

export type StampCard = {
  id: string;
  business: string;
  reward: string;
  stamps: number;
  total: number;
  expiresLabel: string;
  daysLeft: number;
  tone: "primary" | "accent";
};

export type Balance = {
  id: string;
  business: string;
  amount: number;
  cardNumber: string;
  expiresLabel: string;
  daysLeft: number;
};

export type Claim = {
  id: string;
  folio: string;
  subject: string;
  date: string;
  status: "abierta" | "en proceso" | "resuelta";
  detail: string;
};

export type Movement = {
  id: string;
  time: string;
  customer: string;
  phone: string;
  type: "carga" | "canje" | "sello";
  amount: string;
};

export const CUSTOMER = {
  name: "Doña Rosa",
  tier: "Socio Prime",
  otp: "482916",
};

export const balances: Balance[] = [
  {
    id: "b1",
    business: "Taquería La Cuna",
    amount: 128.5,
    cardNumber: "#48210",
    expiresLabel: "Vence el 14 feb 2026",
    daysLeft: 140,
  },
  {
    id: "b2",
    business: "Café El Maguey",
    amount: 64,
    cardNumber: "#90712",
    expiresLabel: "Vence el 3 oct 2026",
    daysLeft: 6,
  },
];

export const stampCards: StampCard[] = [
  {
    id: "s1",
    business: "Taquería La Cuna",
    reward: "Orden de tacos gratis",
    stamps: 3,
    total: 10,
    expiresLabel: "Vence en 5 días",
    daysLeft: 5,
    tone: "primary",
  },
  {
    id: "s2",
    business: "Café El Maguey",
    reward: "Café con leche gratis",
    stamps: 3,
    total: 10,
    expiresLabel: "Renueva en 21 días",
    daysLeft: 21,
    tone: "accent",
  },
  {
    id: "s3",
    business: "Lavandería Aqua",
    reward: "5 kg de lavado gratis",
    stamps: 7,
    total: 8,
    expiresLabel: "Vence en 12 días",
    daysLeft: 12,
    tone: "primary",
  },
];

export const claims: Claim[] = [
  {
    id: "c1",
    folio: "REC-1042",
    subject: "No me dieron mi sello",
    date: "22 sep 2026",
    status: "en proceso",
    detail: "El cajero no registró mi compra del martes.",
  },
  {
    id: "c2",
    folio: "REC-1017",
    subject: "Cobro duplicado de saldo",
    date: "8 sep 2026",
    status: "resuelta",
    detail: "Se devolvieron $85.00 a tu saldo.",
  },
];

export const shiftMovements: Movement[] = [
  { id: "m1", time: "09:12", customer: "Rosa M.", phone: "55 1234 5678", type: "carga", amount: "+$200.00" },
  { id: "m2", time: "09:40", customer: "Luis P.", phone: "55 8871 0091", type: "sello", amount: "+1 sello" },
  { id: "m3", time: "10:05", customer: "Ana G.", phone: "55 2210 7744", type: "canje", amount: "-$85.00" },
  { id: "m4", time: "11:31", customer: "Jorge R.", phone: "55 6690 2213", type: "carga", amount: "+$150.00" },
  { id: "m5", time: "12:18", customer: "Rosa M.", phone: "55 1234 5678", type: "canje", amount: "-1 sello" },
];

export const ownerMetrics = {
  salesToday: 4820,
  customersToday: 37,
  pendingClaims: 2,
  stampsGiven: 64,
  weekly: [
    { day: "Lun", value: 2900 },
    { day: "Mar", value: 3400 },
    { day: "Mié", value: 2600 },
    { day: "Jue", value: 4100 },
    { day: "Vie", value: 5200 },
    { day: "Sáb", value: 6100 },
    { day: "Dom", value: 4820 },
  ],
};

export const money = (value: number) =>
  value.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
