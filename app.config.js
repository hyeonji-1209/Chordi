// app.json을 기반으로 하되, EAS 빌드에서는 시크릿 파일 경로로 google-services.json을 주입한다.
// (공개 저장소라 파일을 커밋하지 않고 EAS secret(GOOGLE_SERVICES_JSON)으로 전달)
const config = require('./app.json');

module.exports = () => {
  const expo = { ...config.expo };
  if (process.env.GOOGLE_SERVICES_JSON) {
    expo.android = { ...expo.android, googleServicesFile: process.env.GOOGLE_SERVICES_JSON };
  }
  return expo;
};
