import mongoose from 'mongoose';
export default async function cleanup() {
  const database = process.env.MYT_UI_DATABASE;
  if (!database || !/^myt_ui_test_[a-f0-9]{32}$/.test(database))
    throw new Error('Unsafe UI test cleanup refused');
  await mongoose.connect('mongodb://127.0.0.1:27018/?replicaSet=myt-dev', {
    dbName: database,
  });
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}
