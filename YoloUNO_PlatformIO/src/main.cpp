#define LED_PIN 48
#define SDA_PIN GPIO_NUM_11
#define SCL_PIN GPIO_NUM_12
#define LIGHT_SENSOR_PIN GPIO_NUM_1
#define LIGHT_PIN GPIO_NUM_6
#define FAN_PIN GPIO_NUM_8
#define MOTION_PIN GPIO_NUM_10
#define RCLK_PIN GPIO_NUM_38
#define SCLK_PIN GPIO_NUM_21
#define DIO_PIN GPIO_NUM_47

#include <WiFi.h>
#include <Arduino_MQTT_Client.h>
#include <ThingsBoard.h>
#include "DHT20.h"
#include "Adafruit_NeoPixel.h"
#include "LiquidCrystal_I2C.h"
#include "Wire.h"
#include <ArduinoOTA.h>

constexpr char WIFI_SSID[] = "LEOBONG";
constexpr char WIFI_PASSWORD[] = "0373552333";

constexpr char TOKEN[] = "fwsnfLZUgPL4Z2tRcxNw";

constexpr char THINGSBOARD_SERVER[] = "app.coreiot.io";
constexpr uint16_t THINGSBOARD_PORT = 1883U;

constexpr uint32_t MAX_MESSAGE_SIZE = 1024U;
constexpr uint32_t SERIAL_DEBUG_BAUD = 115200U;

constexpr char BLINKING_INTERVAL_ATTR[] = "blinkingInterval";
constexpr char LED_MODE_ATTR[] = "ledMode";
constexpr char LED_STATE_ATTR[] = "ledState";

volatile bool attributesChanged = false;
volatile int ledMode = 0;
volatile bool ledState = false;
volatile bool led_on = false;
volatile bool fan_on = false;

constexpr uint16_t BLINKING_INTERVAL_MS_MIN = 10U;
constexpr uint16_t BLINKING_INTERVAL_MS_MAX = 60000U;
volatile uint16_t blinkingInterval = 1000U;

uint32_t previousStateChange;

constexpr int16_t telemetrySendInterval = 10000U;
uint32_t previousDataSend;

constexpr std::array<const char *, 2U> SHARED_ATTRIBUTES_LIST = {
  LED_STATE_ATTR,
  BLINKING_INTERVAL_ATTR
};

WiFiClient wifiClient;
Arduino_MQTT_Client mqttClient(wifiClient);
ThingsBoard tb(mqttClient, MAX_MESSAGE_SIZE);

// ################### Initialize sensors/devices ###################
DHT20 dht20;
float light;
float temperature;
float humidity;
Adafruit_NeoPixel pixels(4, LIGHT_PIN, NEO_GRB + NEO_KHZ800);
LiquidCrystal_I2C lcd(0x21,16,2);
// ##################################################################



// ################### 4-digit 7-segment LED ###################
unsigned char LED_0F[] = 
{// 0	  1	    2	  3	   4	  5	    6	  7	   8	  9	   A	  b	   C    d	    E   F    -
  0xC0,0xF9,0xA4,0xB0,0x99,0x92,0x82,0xF8,0x80,0x90,0x8C,0xBF,0xC6,0xA1,0x86,0xFF,0xbf
};
unsigned char LED[4];

void LED_OUT(unsigned char X)
{
  unsigned char i;
  for(i=8;i>=1;i--)
  {
    if (X&0x80) 
            {
              digitalWrite(DIO_PIN,HIGH);
              }  
            else 
            {
              digitalWrite(DIO_PIN,LOW);
            }
    X<<=1;
            digitalWrite(SCLK_PIN,LOW);
            digitalWrite(SCLK_PIN,HIGH);
  }
}

void LED4_Display(void){
  unsigned char *led_table;          // 查表指针
  unsigned char i;
  //显示第1位
  led_table = LED_0F + LED[0];
  i = *led_table;
  LED_OUT(i);			
  LED_OUT(0x01);		
    digitalWrite(RCLK_PIN,LOW);
    digitalWrite(RCLK_PIN,HIGH);
  //显示第2位
  led_table = LED_0F + LED[1];
  i = *led_table;
  LED_OUT(i);		
  LED_OUT(0x02);		
    digitalWrite(RCLK_PIN,LOW);
    digitalWrite(RCLK_PIN,HIGH);
  //显示第3位
  led_table = LED_0F + LED[2];
  i = *led_table;
  LED_OUT(i);			
  LED_OUT(0x04);	
    digitalWrite(RCLK_PIN,LOW);
    digitalWrite(RCLK_PIN,HIGH);
  //显示第4位
  led_table = LED_0F + LED[3];
  i = *led_table;
  LED_OUT(i);			
  LED_OUT(0x08);		
    digitalWrite(RCLK_PIN,LOW);
    digitalWrite(RCLK_PIN,HIGH);
}
// #############################################################



// ########## Task Pre-declaration for RTOS structure ##########
// Added on 19/02/2025 3:15PM
// Added by Vu Nam Binh
void task_WiFi_connection(void *pvParameters);
void task_CoreIOT_connection(void *pvParameters);
void task_send_telemetry(void *pvParameters);
void task_send_attribute(void *pvParameters);
void task_tb_loop(void *pvParameters);
void task_send_attribute_changed(void *pvParameters);
void task_light_control(void *pvParameters);
void task_fan_control(void *pvParameters);
void task_motion_detect(void *pvParameters);
void task_lcd(void *pvParameters);
void task_update_seven_seg(void *pvParameters);
void task_display_seven_seg(void *pvParameters);
// ###########################################################

RPC_Response setLedSwitchState(const RPC_Data &data) {
    Serial.println("Received Switch state");
    bool newState = data;
    Serial.print("Switch state change: ");
    Serial.println(newState);
    digitalWrite(LED_PIN, newState);
    attributesChanged = true;
    return RPC_Response("setLedSwitchValue", newState);
}

const std::array<RPC_Callback, 1U> callbacks = {
  RPC_Callback{ "setLedSwitchValue", setLedSwitchState }
};

void processSharedAttributes(const Shared_Attribute_Data &data) {
  for (auto it = data.begin(); it != data.end(); ++it) {
    if (strcmp(it->key().c_str(), BLINKING_INTERVAL_ATTR) == 0) {
      const uint16_t new_interval = it->value().as<uint16_t>();
      if (new_interval >= BLINKING_INTERVAL_MS_MIN && new_interval <= BLINKING_INTERVAL_MS_MAX) {
        blinkingInterval = new_interval;
        Serial.print("Blinking interval is set to: ");
        Serial.println(new_interval);
      }
    } else if (strcmp(it->key().c_str(), LED_STATE_ATTR) == 0) {
      ledState = it->value().as<bool>();
      digitalWrite(LED_PIN, ledState);
      Serial.print("LED state is set to: ");
      Serial.println(ledState);
    }
  }
  attributesChanged = true;
}

const Shared_Attribute_Callback attributes_callback(&processSharedAttributes, SHARED_ATTRIBUTES_LIST.cbegin(), SHARED_ATTRIBUTES_LIST.cend());
const Attribute_Request_Callback attribute_shared_request_callback(&processSharedAttributes, SHARED_ATTRIBUTES_LIST.cbegin(), SHARED_ATTRIBUTES_LIST.cend());

void InitWiFi() {
  Serial.println("Connecting to AP ...");
  // Attempting to establish a connection to the given WiFi network
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    // Delay 500ms until a connection has been successfully established
    delay(500);
    Serial.print(".");
  }
  Serial.println("Connected to AP");
}

const bool reconnect() {
  // Check to ensure we aren't connected yet
  const wl_status_t status = WiFi.status();
  if (status == WL_CONNECTED) {
    return true;
  }
  // If we aren't establish a new connection to the given WiFi network
  InitWiFi();
  return true;
}

void setup() {
  Serial.begin(SERIAL_DEBUG_BAUD);
  pinMode(LED_PIN,OUTPUT);
  pinMode(DIO_PIN,OUTPUT);
  pinMode(RCLK_PIN,OUTPUT);
  pinMode(SCLK_PIN,OUTPUT);
  InitWiFi();
  Wire.begin(SDA_PIN, SCL_PIN);   // Put this line of code before any init of devices utilizing I2C such as LCD and DHT20

  // Init LCD and turn on backlight
  lcd.init();
  lcd.backlight();

  // Init DHT20
  dht20.begin();

  // INIT RGB
  pixels.begin();

  // INIT 7-segment LED
  for(int i=0; i<4; i++){
    LED[i] = 0;
  }
  
  // ########## Call tasks ##########
  // Added on 19/02/2025 4:06PM
  // Added by Vu Nam Binh
  xTaskCreate(task_WiFi_connection, "WiFi Connection Check", 4096, NULL, 2, NULL);
  xTaskCreate(task_CoreIOT_connection, "CoreIOT Connection Check", 4096, NULL, 2, NULL);
  xTaskCreate(task_send_telemetry, "Send Telemetry Data", 4096, NULL, 2, NULL);
  xTaskCreate(task_send_attribute, "Send Attribute Data", 4096, NULL, 2, NULL);
  xTaskCreate(task_send_attribute_changed, "Send Attributed Changed Signal", 4096, NULL, 2, NULL);
  xTaskCreate(task_tb_loop, "Thingsboard Loop", 4096, NULL, 2, NULL);
  xTaskCreate(task_light_control, "Light Control", 4096, NULL, 2, NULL);
  xTaskCreate(task_fan_control, "Fan Control", 4096, NULL, 2, NULL);
  xTaskCreate(task_motion_detect, "Motion Detect", 4096, NULL, 2, NULL);
  xTaskCreate(task_lcd, "LCD Control", 4096, NULL, 2, NULL);
  xTaskCreate(task_update_seven_seg, "Update seven-segment LED", 4096, NULL, 2, NULL);
  xTaskCreate(task_display_seven_seg, "Display seven-segment LED", 4096, NULL, 2, NULL);
  // ################################
}

void loop() {
  // CODE TO SEARCH FOR I2C ADDRESS, REFERENCE FROM: https://drive.google.com/file/d/1K-N7fz8qNcXyCX1r8TkXtuNTOyRsfO-n/view?usp=sharing
  // byte error, address;
  // int Devices;
  // Serial.println("Scanning...");
  // Devices = 0;
  // for(address = 1; address < 127; address++ )
  // {

  // Wire.beginTransmission(address);
  // error = Wire.endTransmission();
  // if (error == 0)
  // {
  // Serial.print("I2C device found at address 0x");
  // if (address<16)
  // Serial.print("0");
  // Serial.print(address,HEX);
  // Serial.println("  !");
  // Devices++;
  // }
  // else if (error==4)
  // {
  // Serial.print("Unknown error at address 0x");
  // if (address<16)
  // Serial.print("0");
  // Serial.println(address,HEX);
  // }
  // }
  // if (Devices == 0)
  // Serial.println("No I2C devices found\n");
  // else
  // Serial.println("done\n");
  // delay(5000);  
}

// ########## Task Pre-declaration for RTOS structure ##########
// Added on 19/02/2025 3:15PM
// Added by Vu Nam Binh
void task_WiFi_connection(void *pvParameters)
{
  // WiFi connection will be checked every 30 seconds
  while(1){
    if (!reconnect()) {
      return;
    }
    vTaskDelay(30000);
  }
}

void task_CoreIOT_connection(void *pvParameters)
{
  while(1){
    if (!tb.connected()) {
      Serial.print("Connecting to: ");
      Serial.print(THINGSBOARD_SERVER);
      Serial.print(" with token ");
      Serial.println(TOKEN);
      if (!tb.connect(THINGSBOARD_SERVER, TOKEN, THINGSBOARD_PORT)) {
        Serial.println("Failed to connect");
        return;
      }
  
      tb.sendAttributeData("macAddress", WiFi.macAddress().c_str());
  
      Serial.println("Subscribing for RPC...");
      if (!tb.RPC_Subscribe(callbacks.cbegin(), callbacks.cend())) {
        Serial.println("Failed to subscribe for RPC");
        return;
      }
  
      if (!tb.Shared_Attributes_Subscribe(attributes_callback)) {
        Serial.println("Failed to subscribe for shared attribute updates");
        return;
      }
  
      Serial.println("Subscribe done");
  
      if (!tb.Shared_Attributes_Request(attribute_shared_request_callback)) {
        Serial.println("Failed to request for shared attributes");
        return;
      }
    }
    vTaskDelay(1000);
  }
}

void task_send_telemetry(void *pvParameters)
{
  while(1){
    dht20.read();
    int light_tmp;
    light_tmp = analogRead(LIGHT_SENSOR_PIN);
    light = (light_tmp * 100) / 4096.0;
    
    temperature = dht20.getTemperature();
    humidity = dht20.getHumidity();
  
    if (isnan(temperature) || isnan(humidity)) {
      Serial.println("Failed to read from DHT20 sensor!");
    } else {
      Serial.print("Temperature: "); Serial.print(temperature); Serial.print("°C");
      Serial.print("; Humidity: "); Serial.print(humidity); Serial.print("%");
      Serial.print("; Light: "); Serial.print(light); Serial.print(" lx");
      Serial.println();
  
      tb.sendTelemetryData("light", light);
      tb.sendTelemetryData("temperature", temperature);
      tb.sendTelemetryData("humidity", humidity);
    }

    vTaskDelay(2000);
  }
}

void task_send_attribute(void *pvParameters)
{
  while(1){
    tb.sendAttributeData("rssi", WiFi.RSSI());
    tb.sendAttributeData("channel", WiFi.channel());
    tb.sendAttributeData("bssid", WiFi.BSSIDstr().c_str());
    tb.sendAttributeData("localIp", WiFi.localIP().toString().c_str());
    tb.sendAttributeData("ssid", WiFi.SSID().c_str());

    vTaskDelay(2000);
  }
}

void task_tb_loop(void *pvParameters)
{
  while(1){
    tb.loop();

    vTaskDelay(10);
  }
}

void task_send_attribute_changed(void *pvParameters)
{
  while(1){
    if (attributesChanged) {
      attributesChanged = false;
      tb.sendAttributeData(LED_STATE_ATTR, digitalRead(LED_PIN));
    }

    vTaskDelay(10);
  }
}

void task_light_control(void *pvParameters){
  while(1){
    if(light < 20){
      for(int i=0; i<4; i++){
        pixels.setPixelColor(i, pixels.Color(255,255,255));
      } 
    } else if(light > 40){
      for(int i=0; i<4; i++){
        pixels.setPixelColor(i, pixels.Color(0,0,0));
      }
    }
    pixels.show();

    vTaskDelay(500);
  }
}

void task_fan_control(void *pvParameters){
  int fan_level;
  while(1){
    if(temperature < 28.5){
      fan_level = 0;
    } else if(temperature < 29){
      fan_level = 80;  // around 30% power
    } else if(temperature < 29.5){
      fan_level = 120; // 40%
    } else if(temperature < 30){
      fan_level = 160; // 60%
    } else if(temperature < 30.5){
      fan_level = 200; // 80%;
    } else fan_level = 255;

    analogWrite(FAN_PIN,fan_level);

    vTaskDelay(500);
  }
}

void task_motion_detect(void *pvParameters){
  while(1){
    int motion = analogRead(MOTION_PIN);

    if(motion==0){
      digitalWrite(LED_PIN, LOW);
    } else {
      digitalWrite(LED_PIN, HIGH);
    }

    vTaskDelay(500);
  }
}

void task_lcd(void *pvParameters){
  while(1){
    lcd.clear();

    lcd.setCursor(0,0);
    lcd.print("T:");
    lcd.setCursor(2,0);
    lcd.print((int)temperature);
    lcd.setCursor(4,0);
    lcd.print("*C");

    lcd.setCursor(11,0);
    lcd.print("H:");
    lcd.setCursor(13,0);
    lcd.print((int)humidity);
    lcd.setCursor(15,0);
    lcd.print("%");

    lcd.setCursor(0,1);
    lcd.print("  HCMUT-IOT-CE  ");

    vTaskDelay(1000);
  }
}

void task_update_seven_seg(void *pvParameters){
  while(1){
    LED[0] = LED[0] + 1;
    if(LED[0] >= 10){
      LED[0] = 0;
      LED[1] = LED[1] + 1;
    }
    if(LED[1] >= 6){
      LED[1] = 0;
      LED[2] = LED[2] + 1;
    }
    if(LED[2] >= 10){
      LED[2] = 0;
      LED[3] = LED[3] + 1;
    }
    if(LED[3] >= 6){
      LED[3] = 0;
    }
    vTaskDelay(1000);
  }
}

void task_display_seven_seg(void *pvParameters){
  while(1){
    LED4_Display();

    // vTaskDelay(10);
  }
}
// ###########################################################