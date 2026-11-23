// Manda uma notificacao de teste para os navegadores inscritos de um usuario.
// Uso: node scripts/send-test-push.mjs [email]
// Sem e-mail, usa todas as inscricoes do banco. Le .env (MONGODB_URI e VAPID_*).
import 'dotenv/config';
import mongoose from 'mongoose';
import webpush from 'web-push';

const email = process.argv[2];
const uri = process.env.MONGODB_URI;
const publicKey = process.env.VAPID_PUBLIC_KEY ?? '';
const privateKey = process.env.VAPID_PRIVATE_KEY ?? '';

if (!uri) {
  throw new Error('Falta MONGODB_URI no .env.');
}

if (!publicKey || !privateKey) {
  throw new Error('Faltam VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY no .env.');
}

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:no-reply@azuos.dev',
  publicKey,
  privateKey,
);

await mongoose.connect(uri);

const db = mongoose.connection.db;
let filter = {};

if (email) {
  const user = await db.collection('users').findOne({ email: email.toLowerCase() });

  if (!user) {
    await mongoose.disconnect();
    throw new Error(`Nenhum usuario com o e-mail ${email}.`);
  }

  filter = { userId: user._id };
}

const subscriptions = await db.collection('push_subscriptions').find(filter).toArray();

console.log(`${subscriptions.length} inscricao(oes) encontrada(s).`);

for (const subscription of subscriptions) {
  const payload = JSON.stringify({
    title: 'Azuos Env',
    body: 'Notificacao de teste: o push esta funcionando.',
    url: '/',
    tag: 'teste',
  });

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      payload,
    );
    console.log(`enviado: ${subscription.endpoint.slice(0, 60)}...`);
  } catch (error) {
    console.log(`falhou (${error.statusCode ?? '?'}): ${error.body ?? error.message}`);
  }
}

await mongoose.disconnect();
