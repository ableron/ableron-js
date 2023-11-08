export default class AbstractLogger {
  error(data: any, ...args: any) {
    console.error(data, ...args);
  }
  warn(data: any, ...args: any) {
    console.warn(data, ...args);
  }
  info(data: any, ...args: any) {
    console.info(data, ...args);
  }
  debug(data: any, ...args: any) {
    console.debug(data, ...args);
  }
}
