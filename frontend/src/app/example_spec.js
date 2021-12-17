var textF = element(by.className("text-input ng-untouched ng-pristine ng-valid"))
var sendBtn= element(by.id("sendBtn"))
var getBtn= element(by.id("getBtn"))
var txt = element(by.id("para"))
var msg = "Superman"
describe('angularjs homepage', function() {
  it('Open Local Host', function() {
    browser.get('http://localhost:4200');
  });
  it('Check Text Field', function() {
    expect(textF.isPresent()).toBe(true);
  });
  it('Check Send Message Btn', function() {
    expect(sendBtn.isPresent()).toBe(true);
  });
  it('Check Get Button Message', function() {
    expect(getBtn.isPresent()).toBe(true);
  });
  it('Checking Send Button Functional',   function() {
     textF.sendKeys(msg);
     sendBtn.click();
     browser.sleep(2000);
     //browser.driver.get('http://localhost:4200/');
     browser.switchTo().alert().accept();
    //  expect()
   });
   it('Check Get Button Message', function() {
     browser.sleep(2000);
     getBtn.click();
     expect(txt.getText()).toBe(msg);
     browser.sleep(2000);
   });
})