package module.shop
{
   import §_-0H§.§_-12§;
   import §_-0H§.§_-I§;
   import §_-3i§.§_-Ep§;
   import §_-Iw§.§_-Yj§;
   import common.Session;
   import common.Settings;
   import common.§_-4Y§;
   import common.§_-Ac§;
   import common.misc.QzoneJSAPI;
   import flash.events.EventDispatcher;
   import flash.events.IEventDispatcher;
   import flash.external.ExternalInterface;
   import flash.net.URLLoader;
   import flash.net.URLRequest;
   import flash.net.URLRequestMethod;
   import flash.net.URLVariables;
   import flash.net.sendToURL;
   import framework.net.NetHelper;
   import framework.net.§_-99§;
   import framework.net.vo.§_-P9§;
   import report.EventRecorder;

   public class §_-OZ§ extends EventDispatcher
   {

      internal static const §_-WF§:String = "ShopDataLoaded";

      internal static const §_-FC§:String = "ShopDataLoading";

      internal static const §_-V8§:String = "ShopDataFailed";

      internal static const §_-R8§:String = "BuySeedSuccess";

      internal static const §_-9W§:String = "BuySeedFail";

      internal static const §_-JY§:String = "BuyFishSuccess";

      internal static const §_-Ys§:String = "BuyFishFail";

      internal static const EVENT_BUY_TOOL_SUCCESS:String = "BuyToolSuccess";

      internal static const §_-Vu§:String = "BuyToolFail";

      internal static const EVENT_BUY_DIY_SUCCESS:String = "BuyDiySuccess";

      internal static const §_-VY§:String = "BuyDiyFail";

      internal static const §_-89§:String = "ShopDiyOwnDataLoaded";

      internal static const §_-v§:String = "NormalErrorAlert";

      internal static const §_-YB§:String = "UnlockFishSuccess";

      internal static const §_-24§:String = "UnlockFishFail";

      private var §_-0n§:int;

      private var _diyExp:int;

      private var §_-M§:Boolean;

      private var _buyType:String;

      private var §_-Xl§:Array;

      private var §_-Ft§:Array;

      private var §_-Jw§:Array;

      private var _itemType:String;

      private var §_-8K§:Array;

      private var seedID:int;

      private var seedNum:int;

      private var §_-Nz§:Array;

      private var m_items:Array;

      public function §_-OZ§(param1:IEventDispatcher = null)
      {
         super(param1);
         this.§_-8K§ = null;
         this.m_items = null;
         this.§_-Ft§ = null;
         this.§_-Nz§ = null;
         this.§_-0n§ = -1;
         this.§_-M§ = false;
      }

      public function §_-92§() : void
      {
         if(this.§_-Ft§ != null)
         {
            return;
         }
         dispatchEvent(new §_-Yj§(§_-FC§,{
            "index":3,
            "show":true
         }));
         NetHelper.sendRequest(§_-99§.CMD_GET_SHOP_DIY,null,this.onGetDecorsInfo,this.onLoadDataError);
      }

      private function endTransaction() : void
      {
         this.§_-0n§ = -1;
         this.§_-M§ = false;
      }

      public function §_-Ee§() : void
      {
         var _loc1_:String = "posid=72339074132595919&adposcount=1&count=6&siteset=1&datatype=2";
         var _loc2_:URLVariables = new URLVariables(_loc1_);
         dispatchEvent(new §_-Yj§(§_-FC§,{
            "index":4,
            "show":true
         }));
         NetHelper.getRequest(§_-99§.§_-D8§,_loc2_,this.onGetAdvertisementInfo,this.onLoadDataError);
      }

      private function onUnlockFishSuccess(param1:§_-Ep§) : void
      {
         var _loc2_:* = this.getVOData(param1);
         if(_loc2_ == null)
         {
            return;
         }
         if(_loc2_["code"] == 1)
         {
            dispatchEvent(new §_-Yj§(§_-YB§,_loc2_));
         }
         this.§_-W6§(true);
      }

      private function onDecorsItemLoadedInfo(param1:§_-Ep§) : void
      {
         var _loc4_:Object = null;
         var _loc2_:Object = this.getVOData(param1);
         if(_loc2_ == null)
         {
            return;
         }
         var _loc3_:Array = [];
         for each(_loc4_ in _loc2_[1])
         {
            _loc3_.push(_loc4_._id);
         }
         dispatchEvent(new §_-Yj§(§_-89§,{"data":_loc3_}));
      }

      public function get §_-5u§() : Array
      {
         return this.§_-Xl§;
      }

      private function fishSort(param1:§_-12§, param2:§_-12§) : int
      {
         if(param1 == null || param2 == null)
         {
            return 0;
         }
         var _loc3_:int = param1._output * param1._sale > param2._output * param2._sale ? 1 : -1;
         if(param1._output * param1._sale == param2._output * param2._sale)
         {
            _loc3_ = param1._id > param2._id ? 1 : -1;
         }
         return _loc3_;
      }

      private function onLoadDataError(param1:§_-Ep§) : void
      {
         var _loc2_:* = this.getVOData(param1);
         if(_loc2_ == null)
         {
            return;
         }
         var _loc3_:int = -1;
         if(param1.body != null && param1.body["cmdID"] != undefined)
         {
            if(param1.body["cmdID"] as int == §_-99§.§_-EC§)
            {
               _loc3_ = 0;
               this.§_-WZ§(EventRecorder.HF_GET_SHOP_SEED,false,"mod=usertool&act=getSeedInfo");
               QzoneJSAPI.reportError("商店种子加载失败",2);
            }
            else if(param1.body["cmdID"] as int == §_-99§.§_-3v§)
            {
               _loc3_ = 2;
               this.§_-WZ§(EventRecorder.HF_GET_SHOP_ITEM,false,"mod=usertool&act=getTools");
               QzoneJSAPI.reportError("商店道具加载失败",2);
            }
            else if(param1.body["cmdID"] as int == §_-99§.CMD_GET_SHOP_DIY)
            {
               _loc3_ = 3;
               this.§_-WZ§(EventRecorder.HF_GET_SHOP_DIY,false,"mod=item&act=shop");
               QzoneJSAPI.reportError("商店装饰加载失败",2);
            }
            else if(param1.body["cmdID"] as int == §_-99§.§_-D8§)
            {
               this.§_-WZ§(EventRecorder.HF_GET_SNS_AD,false,"i.gdt.qq.com");
            }
            else if(param1.body["cmdID"] as int == §_-99§.§_-R§)
            {
               _loc3_ = 1;
            }
            else if(param1.body["cmdID"] as int == §_-99§.§_-8q§)
            {
               _loc3_ = 5;
            }
         }
         if(_loc3_ == -1)
         {
            return;
         }
         var _loc4_:String = §_-4Y§.§_-Kf§["请求超时，"] + "<a href=\'event:reload\'><u><font color=\'#ff6600\'>" + §_-4Y§.§_-Kf§["点击重试"] + "</font></u></a>";
         dispatchEvent(new §_-Yj§(§_-V8§,{
            "index":_loc3_,
            "error":_loc4_
         }));
      }

      public function get fishs() : Array
      {
         return this.§_-Jw§;
      }

      private function onGetAdvertisementInfo(param1:§_-Ep§) : void
      {
         var _loc2_:Object = this.getVOData(param1);
         if(_loc2_ == null)
         {
            return;
         }
         if(_loc2_["ret"] != 0)
         {
            dispatchEvent(new §_-Yj§(§_-V8§,{
               "index":4,
               "error":_loc2_["msg"]
            }));
         }
         else if(_loc2_["data"]["72339074132595919"]["ret"] == 0)
         {
            dispatchEvent(new §_-Yj§(§_-FC§,{
               "index":4,
               "show":false
            }));
            if(this.§_-Xl§ == null)
            {
               this.§_-Xl§ = new Array();
            }
            else
            {
               this.§_-Xl§.splice(0);
            }
            this.§_-Xl§ = this.§_-Xl§.concat(_loc2_["data"]["72339074132595919"]["list"]);
            dispatchEvent(new §_-Yj§(§_-WF§,{
               "index":4,
               "data":this.§_-Xl§
            }));
            sendToURL(new URLRequest(_loc2_["data"]["72339074132595919"]["cfg"]["apurl"]));
         }
         else
         {
            dispatchEvent(new §_-Yj§(§_-WF§,{
               "index":4,
               "data":this.§_-Xl§
            }));
         }
         this.§_-WZ§(EventRecorder.HF_GET_SNS_AD,true,"i.gdt.qq.com");
      }

      public function get seeds() : Array
      {
         return this.§_-8K§;
      }

      private function onBuyToolSuccess(param1:§_-Ep§) : void
      {
         var _loc2_:* = this.getVOData(param1);
         if(_loc2_ == null)
         {
            return;
         }
         var _loc3_:Object = {};
         if(param1.body["cmdID"] == §_-99§.§_-JC§ || param1.body["cmdID"] == §_-99§.§_-1J§ || param1.body["cmdID"] == §_-99§.§_-Dg§)
         {
            if(_loc2_["code"] == 1)
            {
               _loc2_["__buyType"] = "0";
               dispatchEvent(new §_-Yj§(EVENT_BUY_TOOL_SUCCESS,_loc2_));
            }
         }
         this.endTransaction();
      }

      public function §_-A1§() : void
      {
         if(this.§_-M§ == true)
         {
            this.§_-M§ = false;
         }
      }

      public function §_-AW§() : void
      {
         if(this.§_-8K§ != null)
         {
            return;
         }
         dispatchEvent(new §_-Yj§(§_-FC§,{
            "index":0,
            "show":true,
            "isact":0
         }));
         NetHelper.sendRequest(§_-99§.§_-EC§,null,this.onGetSeedsInfo,this.onLoadDataError);
      }

      private function onBuySeedSuccess(param1:§_-Ep§) : void
      {
         var _loc3_:String = null;
         var _loc4_:URLVariables = null;
         var _loc2_:* = this.getVOData(param1);
         if(_loc2_ == null)
         {
            return;
         }
         if(_loc2_["code"] == 1)
         {
            dispatchEvent(new §_-Yj§(§_-R8§,_loc2_));
         }
         this.endTransaction();
         if(Boolean(param1["body"]["__body"].hasOwnProperty("isAdSeed")) && Boolean(param1["body"]["__body"]["isAdSeed"]))
         {
            _loc3_ = "actionid=6&targettype=18&tagetid=" + _loc2_["cId"].toString() + "&amt=" + _loc2_["num"].toString();
            _loc4_ = new URLVariables(_loc3_);
            this.postUrl("http://c.gdt.qq.com/gdt_trace_a.fcg",_loc4_,URLRequestMethod.GET);
         }
         this.§_-WZ§(EventRecorder.HF_BUY_SEEDS,true,"mod=repertory&act=buySeed");
      }

      public function §_-W6§(param1:Boolean = false) : void
      {
         if(!Session.getInstance().§_-HR§)
         {
            return;
         }
         if(this.§_-Jw§ != null && !param1)
         {
            return;
         }
         dispatchEvent(new §_-Yj§(§_-FC§,{
            "index":1,
            "show":true
         }));
         NetHelper.sendRequest(§_-99§.§_-R§,null,this.onGetFishInfo,this.onLoadDataError);
      }

      public function §_-TS§(param1:int) : void
      {
         if(this.beginTransaction(parseInt(§_-Ac§.ITEM_TYPE_DIY)) == false)
         {
            return;
         }
         var _loc2_:Object = {"itemId":param1};
         NetHelper.sendRequest(§_-99§.CMD_BUY_DIY,_loc2_,this.onBuyDIYSuccess,this.onTransactionError);
      }

      private function postUrl(param1:String, param2:URLVariables, param3:String) : void
      {
         param1 = QzoneJSAPI.addGToken(param1);
         var _loc4_:URLRequest = new URLRequest(param1);
         _loc4_.data = param2;
         _loc4_.method = param3;
         var _loc5_:URLLoader = new URLLoader();
         _loc5_.load(_loc4_);
      }

      private function onGetAdvertisementSeedsList(param1:§_-Ep§) : void
      {
         var _loc6_:§_-I§ = null;
         var _loc2_:Object = this.getVOData(param1);
         if(_loc2_ == null)
         {
            return;
         }
         if(this.§_-Nz§ == null)
         {
            this.§_-Nz§ = new Array();
         }
         else
         {
            this.§_-Nz§.splice(0);
         }
         this.§_-Nz§ = this.§_-Nz§.concat(_loc2_);
         var _loc3_:Array = null;
         var _loc4_:String = Settings.getInstance().getStringAttribute("crops_sort");
         if(_loc4_ != "")
         {
            _loc3_ = _loc4_.split(",");
         }
         var _loc5_:Object = null;
         for each(_loc6_ in this.§_-Nz§)
         {
            if(_loc3_ != null)
            {
               _loc6_._sort = _loc3_.indexOf(_loc6_._id.toString());
            }
            _loc5_ = Settings.getInstance().getCropByID(_loc6_._id.toString());
            if(_loc5_ != null)
            {
               if(_loc6_._isFood == -1 && _loc5_["isFood"] != undefined)
               {
                  _loc6_._isFood = _loc5_["isFood"] == "1" ? 1 : 0;
               }
               if(_loc6_._isRestaurant == -1 && _loc5_["isRestaurant"] != undefined)
               {
                  _loc6_._isRestaurant = _loc5_["isRestaurant"] == "1" ? 1 : 0;
               }
               if(_loc6_._isActivity == -1 && _loc5_["isActivity"] != undefined)
               {
                  _loc6_._isActivity = _loc5_["isActivity"] == "1" ? 1 : 0;
               }
               if(_loc6_._isMill == -1 && _loc5_["isMill"] != undefined)
               {
                  _loc6_._isMill = _loc5_["isMill"] == "1" ? 1 : 0;
               }
               if(_loc6_._isVip == -1 && _loc5_["isVIP"] != undefined)
               {
                  _loc6_._isVip = _loc5_["isVIP"] == "1" ? 1 : 0;
                  if(_loc5_["vipDesc"] != undefined)
                  {
                     _loc6_._vipDesc = _loc5_["vipDesc"];
                  }
               }
               if(_loc5_["isRed"] != undefined)
               {
                  _loc6_._isRed = _loc5_["isRed"] == "1" ? true : false;
               }
            }
         }
         if(_loc3_ != null)
         {
            this.§_-Nz§.sort(this.seedSort);
         }
         this.§_-8f§();
      }

      public function §_-Ek§(param1:int, param2:int) : void
      {
         if(param1 <= 0 || param2 <= 0)
         {
            return;
         }
         if(this.beginTransaction(parseInt(§_-Ac§.§_-77§)) == false)
         {
            return;
         }
         var _loc3_:* = {
            "fid":param1,
            "num":param2
         };
         NetHelper.sendRequest(§_-99§.§_-3s§,_loc3_,this.onBuyFishSuccess,this.onTransactionError);
      }

      private function seedSort(param1:§_-I§, param2:§_-I§) : int
      {
         if(param1 == null || param2 == null)
         {
            return 0;
         }
         var _loc3_:int = param1._lvl > param2._lvl ? 1 : -1;
         if(param1._lvl == param2._lvl)
         {
            _loc3_ = param1._id > param2._id ? 1 : -1;
         }
         return _loc3_;
      }

      private function onGetSeedsInfo(param1:§_-Ep§) : void
      {
         var _loc6_:§_-I§ = null;
         dispatchEvent(new §_-Yj§(§_-FC§,{
            "index":0,
            "show":false
         }));
         var _loc2_:Object = this.getVOData(param1);
         if(_loc2_ == null)
         {
            return;
         }
         if(this.§_-8K§ == null)
         {
            this.§_-8K§ = new Array();
         }
         else
         {
            this.§_-8K§.splice(0);
         }
         this.§_-8K§ = this.§_-8K§.concat(_loc2_);
         var _loc3_:Array = null;
         var _loc4_:String = Settings.getInstance().getStringAttribute("crops_sort");
         if(_loc4_ != "")
         {
            _loc3_ = _loc4_.split(",");
         }
         var _loc5_:Object = null;
         for each(_loc6_ in this.§_-8K§)
         {
            if(_loc3_ != null)
            {
               _loc6_._sort = _loc3_.indexOf(_loc6_._id.toString());
            }
            _loc5_ = Settings.getInstance().getCropByID(_loc6_._id.toString());
            if(_loc5_ != null)
            {
               if(_loc6_._isFood == -1 && _loc5_["isFood"] != undefined)
               {
                  _loc6_._isFood = _loc5_["isFood"] == "1" ? 1 : 0;
               }
               if(_loc6_._isRestaurant == -1 && _loc5_["isRestaurant"] != undefined)
               {
                  _loc6_._isRestaurant = _loc5_["isRestaurant"] == "1" ? 1 : 0;
               }
               if(_loc6_._isActivity == -1 && _loc5_["isActivity"] != undefined)
               {
                  _loc6_._isActivity = _loc5_["isActivity"] == "1" ? 1 : 0;
               }
               if(_loc6_._isMill == -1 && _loc5_["isMill"] != undefined)
               {
                  _loc6_._isMill = _loc5_["isMill"] == "1" ? 1 : 0;
               }
               if(_loc6_._isVip == -1 && _loc5_["isVIP"] != undefined)
               {
                  _loc6_._isVip = _loc5_["isVIP"] == "1" ? 1 : 0;
                  if(_loc5_["vipDesc"] != undefined)
                  {
                     _loc6_._vipDesc = _loc5_["vipDesc"];
                  }
               }
               if(_loc5_["isRed"] != undefined)
               {
                  _loc6_._isRed = _loc5_["isRed"] == "1" ? true : false;
                  _loc6_._isBlack = _loc5_["isRed"] == "2" ? true : false;
               }
               _loc6_.§_-Rc§ = _loc5_["isYouji"] == 1 ? true : false;
            }
         }
         if(_loc3_ != null)
         {
            this.§_-8K§.sort(this.seedSort);
         }
         dispatchEvent(new §_-Yj§(§_-WF§,{
            "index":0,
            "data":this.§_-8K§
         }));
         this.§_-WZ§(EventRecorder.HF_GET_SHOP_SEED,true,"mod=usertool&act=getSeedInfo");
      }

      public function §_-HJ§(param1:int, param2:int, param3:Boolean = false) : void
      {
         var _loc5_:String = null;
         var _loc6_:URLVariables = null;
         if(param1 == 0 || param2 <= 0)
         {
            return;
         }
         if(this.beginTransaction(parseInt(§_-Ac§.§_-BK§)) == false)
         {
            return;
         }
         var _loc4_:* = {
            "cId":param1,
            "number":param2
         };
         if(param3)
         {
            this.seedID = param1;
            this.seedNum = param2;
            _loc5_ = Settings.getInstance().mode == "" ? "dtype=qq" : "dtype=pengyou";
            _loc6_ = new URLVariables(_loc5_);
            NetHelper.getRequest(§_-99§.§_-2H§,_loc6_,this.onSetCookie,this.onSetCookie);
            return;
         }
         NetHelper.sendRequest(§_-99§.§_-F3§,_loc4_,this.onBuySeedSuccess,this.onTransactionError);
      }

      private function onGetFishInfo(param1:§_-Ep§) : void
      {
         var _loc4_:§_-12§ = null;
         dispatchEvent(new §_-Yj§(§_-FC§,{
            "index":1,
            "show":false
         }));
         var _loc2_:Object = this.getVOData(param1);
         if(_loc2_ == null)
         {
            return;
         }
         if(this.§_-Jw§ == null)
         {
            this.§_-Jw§ = new Array();
         }
         else
         {
            this.§_-Jw§.splice(0);
         }
         this.§_-Jw§ = this.§_-Jw§.concat(_loc2_);
         var _loc3_:Object = null;
         for each(_loc4_ in this.§_-Jw§)
         {
            _loc3_ = Settings.getInstance().getFishByID(_loc4_._id.toString());
            if(_loc3_ != null)
            {
               _loc4_._pool_size = _loc3_["pool_size"];
               _loc4_._exp = _loc3_["exp"];
               _loc4_._name = _loc3_["crop_name"];
               _loc4_._output = _loc3_["output"];
               _loc4_._sale = _loc3_["sale"];
               _loc4_._price = _loc3_["price"];
               _loc4_._mature = _loc3_["mature"];
               if(_loc4_._lock_gold == 0 && _loc3_["lock_money"] != undefined)
               {
                  _loc4_._lock_gold = _loc3_["lock_money"];
               }
               if(_loc4_._lock_crystal == "" && _loc3_["lock_crystal"] != undefined)
               {
                  _loc4_._lock_crystal = _loc3_["lock_crystal"];
               }
            }
         }
         this.§_-Jw§.sort(this.fishSort);
         dispatchEvent(new §_-Yj§(§_-WF§,{
            "index":1,
            "data":this.§_-Jw§
         }));
      }

      public function §_-Zb§(param1:int, param2:int, param3:int, param4:Boolean = false, param5:String = "", param6:int = 0) : void
      {
         if(this.beginTransaction(param3) == false)
         {
            return;
         }
         var _loc7_:* = {
            "tId":param1,
            "number":param2,
            "type":param3
         };
         NetHelper.sendRequest(§_-99§.§_-JC§,_loc7_,this.onBuyToolSuccess,this.onTransactionError);
      }

      private function §_-WZ§(param1:String, param2:Boolean, param3:String, param4:int = 0) : void
      {
         if(param1 == "")
         {
            return;
         }
         if(param2 == true)
         {
            EventRecorder.recordSueecssEvent(param1,null,param3);
         }
         else if(param4 == 0)
         {
            EventRecorder.recordErrorEvent(param1,null,EventRecorder.FAULT_ERROR,param3);
         }
         else
         {
            EventRecorder.recordErrorEvent(param1,null,param4,param3);
         }
      }

      public function §_-3Q§(param1:int) : Boolean
      {
         if(param1 == 0)
         {
            return this.§_-8K§ == null || this.§_-8K§.length == 0 ? true : false;
         }
         if(param1 == 1)
         {
            return this.m_items == null || this.m_items.length == 0 ? true : false;
         }
         if(param1 == 2)
         {
            return this.§_-Ft§ == null || this.§_-Ft§.length == 0 ? true : false;
         }
         if(param1 == 4)
         {
            return this.§_-Jw§ == null || this.§_-Jw§.length == 0 ? true : false;
         }
         return true;
      }

      public function get §_-7w§() : Array
      {
         return this.§_-Ft§;
      }

      private function onSetCookie(param1:§_-Ep§) : void
      {
         var _loc2_:Object = this.getVOData(param1);
         if(_loc2_ == null)
         {
            return;
         }
         if(_loc2_.hasOwnProperty("errorContent"))
         {
            ExternalInterface.call("eval",_loc2_["errorContent"].toString());
         }
         var _loc3_:Object = {
            "cId":this.seedID,
            "number":this.seedNum,
            "isAdSeed":true
         };
         NetHelper.sendRequest(§_-99§.§_-F3§,_loc3_,this.onBuySeedSuccess,this.onTransactionError);
      }

      public function §_-SR§() : void
      {
         if(this.m_items != null)
         {
            return;
         }
         dispatchEvent(new §_-Yj§(§_-FC§,{
            "index":2,
            "show":true
         }));
         NetHelper.sendRequest(§_-99§.§_-3v§,null,this.onGetItemsInfo,this.onLoadDataError);
      }

      public function unlockFish(param1:int) : void
      {
         if(param1 <= 0)
         {
            return;
         }
         var _loc2_:* = {"fid":param1};
         NetHelper.sendRequest(§_-99§.§_-2W§,_loc2_,this.onUnlockFishSuccess,this.onTransactionError);
      }

      public function clear(param1:int) : void
      {
         if(param1 == 0)
         {
            if(this.§_-8K§ != null)
            {
               this.§_-8K§.splice(0);
            }
            this.§_-8K§ = null;
         }
         else if(param1 == 1)
         {
            if(this.m_items != null)
            {
               this.m_items.splice(0);
            }
            this.m_items = null;
         }
         else if(param1 == 2)
         {
            if(this.§_-Ft§ != null)
            {
               this.§_-Ft§.splice(0);
            }
            this.§_-Ft§ = null;
         }
         else if(param1 == 3)
         {
            if(this.§_-Xl§ != null)
            {
               this.§_-Xl§.splice(0);
            }
            this.§_-Xl§ = null;
         }
      }

      private function onInGamePreCheckSuccess(param1:§_-Ep§) : void
      {
         var onInGameBuySuccess:Function = null;
         var obj:Object = null;
         var e:§_-Ep§ = param1;
         onInGameBuySuccess = function(param1:Object):void
         {
            var _loc2_:Object = new Object();
            _loc2_["__buyType"] = 3;
            if(_buyType == "Item")
            {
               _loc2_["type"] = _itemType;
               dispatchEvent(new §_-Yj§(EVENT_BUY_TOOL_SUCCESS,_loc2_));
            }
            else if(_buyType == "DIY")
            {
               if(_diyExp > 0)
               {
                  _loc2_["__exp"] = _diyExp;
               }
               dispatchEvent(new §_-Yj§(EVENT_BUY_DIY_SUCCESS,_loc2_));
            }
         };
         var data:Object = this.getVOData(e);
         if(data["code"] == 1)
         {
            if(data["local"] == 1)
            {
               onInGameBuySuccess(data);
            }
            else
            {
               QzoneJSAPI.getInGamePay(data["url_params"],onInGameBuySuccess);
            }
         }
         else
         {
            obj = new Object();
            obj["direction"] = data["direction"];
            dispatchEvent(new §_-Yj§(§_-VY§,obj));
         }
      }

      public function buyWeapon(param1:int, param2:int, param3:int) : void
      {
         var _loc4_:* = {
            "tId":param1,
            "number":param2,
            "type":param3
         };
         NetHelper.sendRequest(§_-99§.§_-1J§,_loc4_,this.onBuyToolSuccess,this.onTransactionError);
      }

      private function onBuyDIYSuccess(param1:§_-Ep§) : void
      {
         var _loc2_:* = this.getVOData(param1);
         if(_loc2_ == null)
         {
            return;
         }
         var _loc3_:Object = {};
         if(param1.body["cmdID"] == §_-99§.CMD_BUY_DIY)
         {
            if(_loc2_["code"] == 1)
            {
               _loc2_["__buyType"] = "0";
               dispatchEvent(new §_-Yj§(EVENT_BUY_DIY_SUCCESS,_loc2_));
               this.§_-WZ§(EventRecorder.HF_BUY_DIY,true,"mod=cgi_farm_buyitem");
            }
         }
         this.endTransaction();
      }

      private function onGetItemsInfo(param1:§_-Ep§) : void
      {
         dispatchEvent(new §_-Yj§(§_-FC§,{
            "index":2,
            "show":false
         }));
         var _loc2_:Object = this.getVOData(param1);
         if(_loc2_ == null)
         {
            return;
         }
         if(this.m_items == null)
         {
            this.m_items = new Array();
         }
         else
         {
            this.m_items.splice(0);
         }
         this.m_items = this.m_items.concat(_loc2_);
         dispatchEvent(new §_-Yj§(§_-WF§,{
            "index":2,
            "data":this.m_items
         }));
         this.§_-WZ§(EventRecorder.HF_GET_SHOP_ITEM,true,"mod=usertool&act=getTools");
      }

      private function onTransactionError(param1:§_-Ep§) : void
      {
         var _loc2_:* = this.getVOData(param1);
         if(_loc2_ == null)
         {
            return;
         }
         var _loc3_:int = int(param1.body["cmdID"]);
         var _loc4_:Object = {};
         if(_loc3_ == §_-99§.§_-F3§)
         {
            _loc2_["__buyType"] = "0";
            dispatchEvent(new §_-Yj§(§_-9W§,_loc2_));
            this.§_-WZ§(EventRecorder.HF_BUY_SEEDS,false,"mod=repertory&act=buySeed");
         }
         else if(_loc3_ == §_-99§.§_-3s§ || _loc3_ == §_-99§.§_-2W§)
         {
            _loc2_["__buyType"] = "0";
            dispatchEvent(new §_-Yj§(§_-Ys§,_loc2_));
         }
         else if(_loc3_ == §_-99§.§_-JC§ || _loc3_ == §_-99§.§_-Dg§)
         {
            _loc2_["__buyType"] = "0";
            dispatchEvent(new §_-Yj§(§_-Vu§,_loc2_));
         }
         else if(_loc3_ == §_-99§.CMD_BUY_DIY)
         {
            _loc2_["__buyType"] = "0";
            dispatchEvent(new §_-Yj§(§_-VY§,_loc2_));
            if(_loc2_["ecode"] != -30017)
            {
               this.§_-WZ§(EventRecorder.HF_BUY_DIY,false,"mod=cgi_farm_buyitem");
            }
         }
         else if(_loc3_ == §_-99§.§_-PE§)
         {
            dispatchEvent(new §_-Yj§(§_-v§,_loc2_));
         }
         this.endTransaction();
      }

      private function getVOData(param1:§_-Ep§) : Object
      {
         if(param1 == null || param1.result == null)
         {
            return null;
         }
         var _loc2_:§_-P9§ = param1.result as §_-P9§;
         if(_loc2_ == null)
         {
            if(param1.result is Array)
            {
               return param1.result;
            }
            return null;
         }
         return _loc2_.m_extra;
      }

      public function buyInGame(param1:Object, param2:int, param3:String, param4:int = 0, param5:String = "") : void
      {
         if(param4 > 0)
         {
            this._diyExp = param4;
         }
         else
         {
            this._diyExp = 0;
         }
         this._buyType = param3;
         this._itemType = param5;
         param1["payType"] = param2;
         NetHelper.sendRequest(§_-99§.§_-PE§,param1,this.onInGamePreCheckSuccess,this.onTransactionError);
      }

      public function §_-AU§() : void
      {
         dispatchEvent(new §_-Yj§(§_-FC§,{
            "index":5,
            "show":true
         }));
         var _loc1_:Object = {"isact":1};
         NetHelper.sendRequest(§_-99§.§_-EC§,_loc1_,this.onGetAdvertisementSeedsList,this.onLoadDataError);
      }

      private function onGetDecorsInfo(param1:§_-Ep§) : void
      {
         dispatchEvent(new §_-Yj§(§_-FC§,{
            "index":3,
            "show":false
         }));
         var _loc2_:Object = this.getVOData(param1);
         if(_loc2_ == null)
         {
            return;
         }
         if(this.§_-Ft§ == null)
         {
            this.§_-Ft§ = new Array();
         }
         else
         {
            this.§_-Ft§.splice(0);
         }
         this.§_-Ft§ = this.§_-Ft§.concat(_loc2_);
         this.§_-Ft§.reverse();
         var _loc3_:* = null;
         var _loc4_:int = 0;
         while(_loc4_ < this.§_-Ft§.length)
         {
            _loc3_ = this.§_-Ft§[_loc4_];
            this.§_-Ft§[_loc4_] = this.§_-Ft§[_loc4_ + 3];
            this.§_-Ft§[_loc4_ + 3] = _loc3_;
            _loc3_ = this.§_-Ft§[_loc4_ + 1];
            this.§_-Ft§[_loc4_ + 1] = this.§_-Ft§[_loc4_ + 2];
            this.§_-Ft§[_loc4_ + 2] = _loc3_;
            _loc4_ += 4;
         }
         dispatchEvent(new §_-Yj§(§_-WF§,{
            "index":3,
            "data":this.§_-Ft§
         }));
         this.§_-WZ§(EventRecorder.HF_GET_SHOP_DIY,true,"mod=item&act=shop");
      }

      private function onGetAdvertisementSeedsInfo(param1:§_-Ep§) : void
      {
         var _loc3_:Array = null;
         var _loc4_:Array = null;
         var _loc5_:Object = null;
         var _loc6_:int = 0;
         var _loc7_:String = null;
         var _loc8_:Array = null;
         var _loc9_:* = 0;
         var _loc10_:URLVariables = null;
         var _loc11_:String = null;
         var _loc12_:int = 0;
         var _loc13_:URLVariables = null;
         var _loc2_:Object = this.getVOData(param1);
         if(_loc2_ == null)
         {
            return;
         }
         if(_loc2_["ret"] != 0)
         {
            dispatchEvent(new §_-Yj§(§_-V8§,{
               "index":5,
               "error":_loc2_["msg"]
            }));
         }
         else if(_loc2_["data"]["144396668170523855"]["ret"] == 0)
         {
            dispatchEvent(new §_-Yj§(§_-FC§,{
               "index":5,
               "show":false
            }));
            _loc3_ = [];
            _loc3_ = _loc3_.concat(_loc2_["data"]["144396668170523855"]["list"]);
            _loc4_ = [];
            for each(_loc5_ in _loc3_)
            {
               _loc4_.push(_loc5_["targetid"]);
            }
            _loc6_ = 0;
            _loc7_ = "";
            _loc8_ = [];
            _loc9_ = int(this.§_-Nz§.length);
            while(_loc9_ > 0)
            {
               _loc9_--;
               if(_loc4_.indexOf(this.§_-Nz§[_loc6_]._id.toString()) == -1)
               {
                  this.§_-Nz§.splice(_loc6_,1);
               }
               else
               {
                  this.§_-Nz§[_loc6_]._isAdSeed = 1;
                  this.§_-Nz§[_loc6_]._rl = _loc3_[_loc4_.indexOf(this.§_-Nz§[_loc6_]._id.toString())]["rl"];
                  _loc7_ = _loc3_[_loc4_.indexOf(this.§_-Nz§[_loc6_]._id.toString())]["apurl"].toString();
                  _loc7_ = _loc7_.substr(_loc7_.indexOf("fcg?") + 4);
                  _loc13_ = new URLVariables(_loc7_);
                  _loc8_.push(_loc13_["viewid"]);
                  _loc6_++;
               }
            }
            dispatchEvent(new §_-Yj§(§_-WF§,{
               "index":5,
               "data":this.§_-Nz§
            }));
            _loc10_ = new URLVariables();
            _loc11_ = "";
            _loc12_ = 0;
            while(_loc12_ < _loc8_.length)
            {
               _loc11_ = "viewid" + _loc12_.toString();
               _loc10_[_loc11_] = _loc8_[_loc12_];
               _loc12_++;
            }
            _loc10_["count"] = _loc8_.length;
            this.postUrl("http://v.gdt.qq.com/gdt_stats.fcg",_loc10_,URLRequestMethod.POST);
         }
         else
         {
            dispatchEvent(new §_-Yj§(§_-WF§,{
               "index":5,
               "data":null
            }));
         }
      }

      private function onBuyFishSuccess(param1:§_-Ep§) : void
      {
         var _loc2_:* = this.getVOData(param1);
         if(_loc2_ == null)
         {
            return;
         }
         if(_loc2_["code"] == 1)
         {
            dispatchEvent(new §_-Yj§(§_-JY§,_loc2_));
         }
         this.endTransaction();
      }

      public function §_-8f§() : void
      {
         var _loc1_:String = "posid=144396668170523855&adposcount=1&count=15&callback=_gdttxtbc&datatype=2";
         var _loc2_:URLVariables = new URLVariables(_loc1_);
         NetHelper.getRequest(§_-99§.§_-8q§,_loc2_,this.onGetAdvertisementSeedsInfo,this.onGetAdvertisementSeedsInfo);
      }

      public function §_-DG§() : void
      {
         if(this.§_-Ft§ == null)
         {
            return;
         }
         NetHelper.sendRequest(§_-99§.§_-9z§,null,this.onDecorsItemLoadedInfo,this.onLoadDataError);
      }

      private function beginTransaction(param1:int) : Boolean
      {
         if(this.§_-M§ == true)
         {
            return false;
         }
         this.§_-0n§ = param1;
         this.§_-M§ = true;
         return true;
      }

      public function get items() : Array
      {
         return this.m_items;
      }

      public function §_-KF§(param1:int, param2:int) : void
      {
         if(param1 == 0 || param2 <= 0)
         {
            return;
         }
         var _loc3_:* = {
            "itemId":param1,
            "itemNum":param2
         };
         NetHelper.sendRequest(§_-99§.§_-Dg§,_loc3_,this.onBuyToolSuccess,this.onTransactionError);
      }
   }
}
