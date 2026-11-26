/**
 * Em host serverless (Vercel) a função morre entre as requisições: cron não
 * dispara e sincronizar os jobs no boot só paga ida ao banco em todo cold start.
 * `SCHEDULERS=on|off` força o comportamento; sem ela, liga fora da Vercel.
 */
export function schedulersEnabled(): boolean {
  const flag = process.env.SCHEDULERS;

  if (flag === 'on' || flag === 'off') {
    return flag === 'on';
  }

  return !process.env.VERCEL;
}
