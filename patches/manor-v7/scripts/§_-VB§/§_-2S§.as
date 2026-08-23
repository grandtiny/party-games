package §_-VB§
{
   import §_-0H§.Player;
   import §_-0H§.§_-49§;
   import §_-3i§.§_-Ep§;
   import §_-Hp§.§_-E8§;
   import §_-Hp§.§_-aH§;
   import §_-Iw§.§_-Yj§;
   import common.CommonData;
   import common.Session;
   import common.Settings;
   import common.§_-4Y§;
   import common.§_-Ac§;
   import flash.events.Event;
   import flash.events.EventDispatcher;
   import flash.net.URLVariables;
   import framework.net.NetHelper;
   import framework.net.§_-99§;
   import framework.net.vo.§_-P9§;
   
   public class §_-2S§ extends EventDispatcher
   {
      
      public static const §_-55§:String = "WeatherDataChanged";
      
      public static const §_-Ov§:String = "PlayerBaseInfoChanged";
      
      public static const §_-1X§:String = "PlayerAccountChanged";
      
      public static const §_-Gd§:String = "OfflineDataChanged";
      
      public static const §_-Kd§:String = "SystemPostMsgLoaded";
      
      public static const §_-DI§:String = "EverydayGiftLoaded";
      
      public static const §_-Jh§:String = "EverydayGiftAccepted";
      
      public static const §_-DU§:String = "OfflineDataMessage";
      
      public static const §_-N9§:String = "LevelupDataChanged";
      
      public static const §_-KI§:String = "LevelUpGiftLoaded";
      
      public static const §_-AF§:String = "getVipReturnGift";
      
      public static const GET_CARDSGAME_DATA:String = "getCardsGameData";
      
      public static const §_-Uc§:String = "getFreeGift";
      
      public static const §_-WY§:String = "showWarnMsg";
      
      private var §_-Zd§:§_-aH§;
      
      private var §_-Lp§:Object;
      
      private var m_giftDataLoading:Boolean;
      
      private var m_weather:String;
      
      private var m_controller:§_-1B§;
      
      private var §_-Rh§:Player;
      
      private var §_-N8§:Boolean;
      
      private var §_-26§:Object;
      
      private var §_-KH§:Boolean;
      
      private var §_-Mm§:XML;
      
      private var m_freeDataLoading:Boolean;
      
      private var §_-Lf§:§_-E8§;
      
      private var §_-9n§:Object;
      
      private var §_-X3§:Array;
      
      public function §_-2S§(param1:§_-1B§)
      {
         super();
         this.m_weather = §_-Ac§.§_-1G§;
         this.§_-Zd§ = new §_-aH§();
         this.§_-Lf§ = new §_-E8§();
         this.§_-9n§ = null;
         this.§_-KH§ = false;
         this.§_-Lp§ = null;
         this.m_giftDataLoading = false;
         this.§_-26§ = null;
         this.m_freeDataLoading = false;
         this.§_-X3§ = null;
         this.§_-N8§ = false;
         this.§_-Mm§ = null;
         this.§_-Rh§ = Session.getInstance().host;
         this.m_controller = param1;
      }
      
      public function get weather() : String
      {
         return this.m_weather;
      }
      
      private function onPostMsgLoaded(param1:§_-Ep§) : void
      {
         var _loc2_:* = NetHelper.getVOData(param1);
         if(_loc2_ == null)
         {
            return;
         }
         this.§_-KH§ = false;
         this.§_-9n§ = _loc2_;
         dispatchEvent(new §_-Yj§(§_-Kd§,_loc2_));
         if(_loc2_["have_new_feeds"] == true)
         {
            this.§_-Lf§.§_-Ly§ = 1;
            dispatchEvent(new §_-Yj§(§_-Gd§,this.§_-Lf§));
            this.m_controller.module.app.dispatchEvent(new §_-Yj§(§_-Ac§.§_-Es§,null));
         }
         if(_loc2_["have_new_sysmsg"] == true)
         {
            this.§_-Lf§.§_-Ba§ = 1;
            dispatchEvent(new §_-Yj§(§_-Gd§,this.§_-Lf§));
            dispatchEvent(new §_-Yj§(§_-DU§,4));
         }
         if(_loc2_["have_new_warnmsg"] == true)
         {
            dispatchEvent(new §_-Yj§(§_-WY§,_loc2_));
         }
      }
      
      private function onEverydayGiftLoaded(param1:§_-Ep§) : void
      {
         this.m_giftDataLoading = false;
         var _loc2_:* = NetHelper.getVOData(param1);
         if(_loc2_ == null)
         {
            return;
         }
         this.§_-Lp§ = _loc2_;
         _loc2_["everyDayGift"] = true;
         dispatchEvent(new §_-Yj§(§_-DI§,_loc2_));
      }
      
      public function vipReturnQuery() : void
      {
         var _loc1_:Object = null;
         if(this.§_-Rh§._yellowstatus == 0 && this.§_-Rh§._yellowlevel != 0)
         {
            _loc1_ = new Object();
            _loc1_["opt"] = 0;
            _loc1_["isfarm"] = 1;
            NetHelper.sendRequest(§_-99§.§_-Az§,_loc1_,this.onVipReturnGiftQueryed,this.onNetError);
         }
      }
      
      public function §_-A1§() : void
      {
         if(this.§_-KH§ == true)
         {
            this.§_-KH§ = false;
            this.§_-9n§ = null;
         }
         if(this.m_giftDataLoading == true)
         {
            this.m_giftDataLoading = false;
            this.§_-Lp§ = null;
         }
         if(this.m_freeDataLoading == true)
         {
            this.m_freeDataLoading = false;
            this.§_-26§ = null;
         }
      }
      
      private function onFreeGiftLoaded(param1:§_-Ep§) : void
      {
         var _loc2_:* = NetHelper.getVOData(param1);
         if(_loc2_ == null)
         {
            return;
         }
         this.m_freeDataLoading = false;
         this.§_-26§ = _loc2_;
         CommonData.freeGift = this.§_-26§;
         dispatchEvent(new §_-Yj§(§_-Uc§,this.§_-26§));
      }
      
      private function onVipReturnGiftQueryed(param1:§_-Ep§) : void
      {
         if(param1 == null || param1.result == null)
         {
            return;
         }
         var _loc2_:§_-P9§ = param1.result as §_-P9§;
         if(_loc2_ == null || _loc2_.m_extra == null)
         {
            return;
         }
         var _loc3_:Object = _loc2_.m_extra;
         if(_loc3_.hasOwnProperty("code") && _loc3_["code"] == 1)
         {
            this.§_-Lf§.§_-Ty§ = 1;
            this.§_-Lp§ = _loc3_;
            Session.getInstance().§_-6§ = true;
            dispatchEvent(new §_-Yj§(§_-AF§,null));
         }
      }
      
      public function §_-Be§(param1:Boolean) : void
      {
         var _loc2_:Object = null;
         if(param1)
         {
            _loc2_ = new Object();
            _loc2_["opt"] = 1;
            _loc2_["isfarm"] = 1;
            NetHelper.sendRequest(§_-99§.§_-Az§,_loc2_,this.onEverydayGiftAccepted,this.onNetError);
         }
         else
         {
            NetHelper.sendRequest(§_-99§.§_-RO§,null,this.onEverydayGiftAccepted,this.onNetError);
         }
      }
      
      public function §_-1W§() : Boolean
      {
         if(this.§_-N8§ == true)
         {
            return false;
         }
         if(this.§_-X3§ == null && this.§_-X3§.length == 0)
         {
            return false;
         }
         this.§_-N8§ = true;
         NetHelper.sendRequest(§_-99§.§_-AC§,{
            "lv":this.§_-X3§[0],
            "op":1
         },this.onLevelUpGiftData,this.onNetError);
         return true;
      }
      
      public function §_-Fe§() : void
      {
         var _loc1_:Player = Session.getInstance().host;
         if(_loc1_ == null)
         {
            return;
         }
         this.§_-Zd§.m_userName = _loc1_._userName;
         this.§_-Zd§.m_photoUrl = _loc1_._headPic;
         dispatchEvent(new Event(§_-Ov§));
         this.§_-Zd§.m_exp = _loc1_._exp;
         this.§_-Zd§.m_gold = _loc1_._money;
         this.§_-Zd§.§_-RF§ = _loc1_._moralExp;
         dispatchEvent(new Event(§_-1X§));
      }
      
      private function onCardsGameQueryed(param1:§_-Ep§) : void
      {
         if(param1 == null || param1.result == null)
         {
            return;
         }
         var _loc2_:§_-P9§ = param1.result as §_-P9§;
         if(_loc2_ == null || _loc2_.m_extra == null)
         {
            return;
         }
         var _loc3_:Object = _loc2_.m_extra;
         var _loc4_:Session = Session.getInstance();
         if(_loc3_.hasOwnProperty("code") && _loc3_["code"] == 1)
         {
            _loc4_.loginDays = _loc3_["days"];
            _loc4_.§_-8J§ = int(_loc3_["bonus"]);
            if(this.§_-Rh§._yellowstatus != 0)
            {
               _loc4_.remainPlays = 2 - int(_loc3_["number"]);
            }
            else
            {
               _loc4_.remainPlays = 1 - int(_loc3_["number"]);
            }
            dispatchEvent(new §_-Yj§(GET_CARDSGAME_DATA,true));
         }
      }
      
      public function setWeather(param1:§_-49§) : void
      {
         if(param1 == null)
         {
            return;
         }
         var _loc2_:int = new Date().getHours();
         if(_loc2_ > 6 && _loc2_ < 20)
         {
            if(param1._weatherId == 1)
            {
               this.m_weather = §_-Ac§.§_-1G§;
            }
            else if(param1._weatherId == 3)
            {
               this.m_weather = §_-Ac§.§_-NZ§;
            }
            else
            {
               this.m_weather = §_-Ac§.§_-1G§;
            }
         }
         else
         {
            this.m_weather = §_-Ac§.§_-MK§;
         }
         dispatchEvent(new Event(§_-55§));
      }
      
      private function onEverydayGiftAccepted(param1:§_-Ep§) : void
      {
         var _loc2_:* = NetHelper.getVOData(param1);
         if(_loc2_ != null)
         {
            _loc2_["everyDayGift"] = true;
            _loc2_["claimed"] = true;
            this.§_-Lp§ = _loc2_;
         }
         if(Session.getInstance().§_-6§)
         {
            _loc2_ = this.§_-Vh§();
            dispatchEvent(new §_-Yj§(§_-Jh§,_loc2_));
         }
         else
         {
            dispatchEvent(new §_-Yj§(§_-Jh§,_loc2_));
         }
         if(this.§_-Lp§ != null)
         {
            this.§_-Lp§["direction"] = "今日每日礼包已经领取。";
            this.§_-Lp§["item"] = [];
            this.§_-Lp§["vipItem"] = [];
         }
         this.§_-Lf§.§_-Ty§ = 0;
         Session.getInstance().§_-6§ = false;
      }
      
      public function §_-ZG§() : Object
      {
         if(this.§_-26§ != null)
         {
            return this.§_-26§;
         }
         if(this.m_freeDataLoading == true)
         {
            return null;
         }
         this.m_freeDataLoading = true;
         NetHelper.sendRequest(§_-99§.§_-RH§,null,this.onFreeGiftLoaded,this.onNetError);
         return null;
      }
      
      public function §_-Vh§() : Object
      {
         if(this.§_-Lp§ != null)
         {
            return this.§_-Lp§;
         }
         return null;
      }
      
      public function get restaurantCongfig() : XML
      {
         return this.§_-Mm§;
      }
      
      public function get freeGift() : Object
      {
         return this.§_-26§;
      }
      
      private function onLevelUpResponse(param1:§_-Ep§) : void
      {
         var _loc2_:* = NetHelper.getVOData(param1);
         if(_loc2_ == null)
         {
            return;
         }
         if(_loc2_["hasgift"] == undefined || _loc2_["hasgift"] == false)
         {
            return;
         }
         this.addLevelUp(_loc2_);
      }
      
      public function §_-Le§() : void
      {
         var _loc1_:int = parseInt(Settings.getInstance().getStringAttribute("CardsGameAllowLvl"));
         if(this.§_-Rh§._yellowlevel >= _loc1_)
         {
            NetHelper.sendRequest(§_-99§.CMD_GET_CARDSGAME_DATA,null,this.onCardsGameQueryed,this.onNetError);
         }
      }
      
      public function §_-QA§() : Object
      {
         if(this.§_-Lp§ != null)
         {
            return this.§_-Lp§;
         }
         if(this.m_giftDataLoading == true)
         {
            return null;
         }
         this.m_giftDataLoading = true;
         NetHelper.sendRequest(§_-99§.§_-YU§,null,this.onEverydayGiftLoaded,this.onNetError);
         return null;
      }
      
      public function get postMsg() : Object
      {
         return this.§_-9n§;
      }
      
      public function get §_-T5§() : §_-aH§
      {
         return this.§_-Zd§;
      }
      
      public function updateHostInfo() : void
      {
         var _loc1_:Player = Session.getInstance().host;
         if(_loc1_ == null)
         {
            return;
         }
         var _loc2_:Boolean = false;
         if(this.§_-Zd§.m_userName != _loc1_._userName)
         {
            this.§_-Zd§.m_userName = _loc1_._userName;
            _loc2_ = true;
         }
         if(this.§_-Zd§.m_photoUrl != _loc1_._headPic)
         {
            this.§_-Zd§.m_photoUrl = _loc1_._headPic;
            _loc2_ = true;
         }
         if(_loc2_ == true)
         {
            dispatchEvent(new Event(§_-Ov§));
         }
         _loc2_ = false;
         if(this.§_-Zd§.m_gold != _loc1_._money)
         {
            this.§_-Zd§.m_gold = _loc1_._money;
            _loc2_ = true;
         }
         if(this.§_-Zd§.m_exp != _loc1_._exp)
         {
            this.§_-Zd§.m_exp = _loc1_._exp;
            _loc2_ = true;
         }
         if(this.§_-Zd§.m_fb != _loc1_._fb)
         {
            this.§_-Zd§.m_fb = _loc1_._fb;
            _loc2_ = true;
         }
         if(this.§_-Zd§.§_-RF§ != _loc1_._moralExp)
         {
            this.§_-Zd§.§_-RF§ = _loc1_._moralExp;
            _loc2_ = true;
         }
         if(_loc2_ == true)
         {
            dispatchEvent(new Event(§_-1X§));
         }
      }
      
      public function addLevelUp(param1:Object) : void
      {
         var _loc2_:Array = null;
         var _loc3_:int = 0;
         if(param1 == null)
         {
            return;
         }
         if(param1.hasOwnProperty("hasgift") == true && param1["hasgift"] as Boolean == true)
         {
            _loc2_ = param1["lvup"] as Array;
            if(_loc2_ == null)
            {
               return;
            }
            if(this.§_-X3§ == null)
            {
               this.§_-X3§ = _loc2_;
            }
            else
            {
               for each(_loc3_ in _loc2_)
               {
                  if(this.§_-X3§.indexOf(_loc3_) == -1)
                  {
                     this.§_-X3§.push(_loc3_);
                  }
               }
            }
         }
         if(param1 is Array && param1.length > 0)
         {
            this.§_-X3§ = param1 as Array;
         }
         dispatchEvent(new §_-Yj§(§_-N9§,this.§_-X3§));
      }
      
      public function set weather(param1:String) : void
      {
         this.m_weather = param1;
      }
      
      private function onNetError(param1:§_-Ep§) : void
      {
         if(param1 == null || param1.body == null)
         {
            return;
         }
         var _loc2_:int = param1.body["cmdID"] as int;
         var _loc3_:§_-P9§ = param1.result as §_-P9§;
         var _loc4_:String = "";
         if(_loc3_ == null || _loc3_.§_-WR§ == "")
         {
            _loc4_ = §_-4Y§.§_-Kf§["请求超时，稍后再试"];
         }
         else
         {
            _loc4_ = _loc3_.§_-WR§;
         }
         if(_loc2_ == §_-99§.§_-15§)
         {
            this.§_-KH§ = false;
         }
         else if(_loc2_ == §_-99§.§_-YU§)
         {
            this.m_giftDataLoading = false;
         }
         else if(_loc2_ == §_-99§.§_-RH§)
         {
            this.m_freeDataLoading = false;
         }
         else if(_loc2_ == §_-99§.§_-AC§)
         {
            if(param1.body["__body"]["op"] == 1)
            {
               this.§_-N8§ = false;
            }
         }
      }
      
      public function updateOfflineStatus(param1:Object) : void
      {
         var _loc2_:Boolean = false;
         if(param1 != null)
         {
            if(this.§_-Lf§.§_-9f§ != param1["b"])
            {
               this.§_-Lf§.§_-9f§ = param1["b"] as int;
               _loc2_ = true;
            }
            if(this.§_-Lf§.§_-Ba§ != param1["c"])
            {
               this.§_-Lf§.§_-Ba§ = param1["c"] as int;
               _loc2_ = true;
            }
            if(this.§_-Lf§.§_-Ty§ != param1["d"])
            {
               this.§_-Lf§.§_-Ty§ = param1["d"] as int;
               _loc2_ = true;
            }
            if(this.§_-Lf§.§_-Lj§ != param1["e"])
            {
               this.§_-Lf§.§_-Lj§ = param1["e"] as int;
               _loc2_ = true;
            }
         }
         if(_loc2_ == true)
         {
            dispatchEvent(new §_-Yj§(§_-Gd§,this.§_-Lf§));
         }
      }
      
      public function §_-Kx§() : Object
      {
         if(this.§_-9n§ != null)
         {
            return this.§_-9n§;
         }
         if(this.§_-KH§ == true)
         {
            return null;
         }
         this.§_-KH§ = true;
         var _loc1_:URLVariables = new URLVariables();
         _loc1_["appId"] = 353;
         _loc1_["serviceId"] = Settings.getInstance().mode == "" ? 2 : 1;
         _loc1_["uin"] = Session.getInstance().host._uinLogin;
         NetHelper.getRequest(§_-99§.§_-15§,_loc1_,this.onPostMsgLoaded,this.onNetError);
         return null;
      }
      
      public function §_-E3§() : void
      {
         this.§_-Lf§.§_-Ly§ = 0;
         this.§_-Lf§.§_-Ba§ = 0;
         dispatchEvent(new §_-Yj§(§_-Gd§,this.§_-Lf§));
      }
      
      public function checkLevelup(param1:int) : void
      {
         if(param1 <= 0)
         {
            return;
         }
         var _loc2_:int = Session.getInstance().host._exp;
         var _loc3_:int = Math.sqrt((_loc2_ + 25) / 100) - 0.5;
         var _loc4_:int = Math.sqrt((_loc2_ + param1 + 25) / 100) - 0.5;
         if(_loc4_ > _loc3_)
         {
            NetHelper.sendRequest(§_-99§.§_-AC§,{
               "level":_loc4_,
               "op":0
            },this.onLevelUpResponse,this.onLevelUpResponse);
         }
      }
      
      public function get §_-XT§() : Object
      {
         return this.§_-Lp§;
      }
      
      private function onLevelUpGiftData(param1:§_-Ep§) : void
      {
         var _loc3_:int = 0;
         var _loc4_:int = 0;
         var _loc5_:* = undefined;
         var _loc2_:* = NetHelper.getVOData(param1);
         if(_loc2_ == null)
         {
            return;
         }
         this.§_-N8§ = false;
         if(_loc2_["lv"] != undefined)
         {
            _loc3_ = _loc2_["lv"] as int;
            if(this.§_-X3§ != null)
            {
               _loc4_ = this.§_-X3§.indexOf(_loc3_);
               while(_loc4_ != -1)
               {
                  this.§_-X3§.splice(_loc4_,1);
                  _loc4_ = this.§_-X3§.indexOf(_loc3_);
               }
               dispatchEvent(new §_-Yj§(§_-N9§,this.§_-X3§));
            }
         }
         if(_loc2_["direction"] == undefined)
         {
            _loc2_["direction"] = "恭喜您升到" + _loc3_ + "级，赠送您 ";
            for each(_loc5_ in _loc2_["item"])
            {
               if(_loc5_["num"] > 0 && _loc5_["name"] != undefined && _loc5_["name"] != "")
               {
                  _loc2_["direction"] += _loc5_["num"] + "个" + _loc5_["name"] + "，";
               }
            }
            _loc2_["direction"] = _loc2_["direction"].slice(0,_loc2_["direction"].length - 1);
         }
         if(_loc2_["vipItem"] != undefined && _loc2_["vipText"] == undefined)
         {
            _loc2_["vipText"] = "您是尊贵的VIP贵族，还可额外获得以下奖励：";
         }
         _loc2_["levelup"] = true;
         _loc2_["big"] = true;
         _loc2_["title"] = "查看礼包";
         dispatchEvent(new §_-Yj§(§_-KI§,_loc2_));
      }
   }
}

