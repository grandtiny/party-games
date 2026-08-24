package module
{
   import §_-0H§.Friend;
   import §_-0H§.Player;
   import §_-0H§.§_-UU§;
   import §_-1v§.§_-Bm§;
   import §_-3i§.§_-Ep§;
   import §_-42§.§_-Mn§;
   import §_-6B§.§_-7V§;
   import §_-D1§.Application;
   import §_-Iw§.§_-Yj§;
   import §_-JM§.§_-1R§;
   import §_-JM§.§_-3§;
   import §_-Oq§.§_-4-§;
   import §_-VB§.§_-5z§;
   import §_-WC§.§_-2b§;
   import com.adobe.serialization.json.JSON;
   import com.qzone.qfa.debug.§_-B9§;
   import com.qzone.qfa.view.§_-9c§;
   import common.CommonData;
   import common.Session;
   import common.Settings;
   import common.§_-4Y§;
   import common.§_-Ac§;
   import common.misc.QzoneJSAPI;
   import common.misc.Utils;
   import common.misc.time.GameTime;
   import common.view.window.§_-78§;
   import common.view.window.§_-KR§;
   import flash.display.DisplayObjectContainer;
   import flash.display.Loader;
   import flash.events.Event;
   import flash.events.EventDispatcher;
   import flash.events.TimerEvent;
   import flash.net.URLRequest;
   import flash.system.LoaderContext;
   import flash.utils.Timer;
   import flash.utils.getTimer;
   import framework.api.FarmAPI;
   import framework.api.§_-20§;
   import framework.api.beast.BeastAPI;
   import framework.base.§_-5w§;
   import framework.base.§_-90§;
   import framework.commands.§_-Vf§;
   import framework.net.§_-99§;
   import framework.net.protocol.§_-Vz§;
   import framework.net.vo.§_-P9§;
   import module.cardsgame.ModuleCardsGame;
   import module.decorate.§_-XA§;
   import module.friend.§_-Tm§;
   import module.health.§_-WX§;
   import module.recall.§_-3X§;
   import module.shop.ModuleShop;
   import module.task.§_-Z2§;
   import module.warehouse.ModuleWarehouse;
   import report.EventRecorder;
   import report.UserActionRecorder;

   public class FarmApplication extends Application implements §_-3§
   {

      public var wildShell:*;

      private var m_mainLoop:Timer;

      private var m_requestStartTime:int;

      private var §_-7l§:Object;

      private var §_-7y§:Boolean;

      private var §_-ZZ§:Object;

      private var §_-3b§:Array;

      private var §_-G9§:Friend;

      private var §_-Q2§:EventDispatcher;

      public var beastAPI:BeastAPI;

      private var §_-2-§:int;

      private var §_-YJ§:§_-78§;

      private var §_-BL§:FarmAPI;

      private var m_gameTime:GameTime;

      private var §_-DE§:Boolean;

      public function FarmApplication(param1:String = "", param2:DisplayObjectContainer = null)
      {
         super(param1,param2);
         this.§_-Q2§ = new EventDispatcher();
         this.§_-3b§ = null;
         this.m_mainLoop = null;
         this.§_-2-§ = 1 * 100 / §_-Ac§.§_-C7§;
         this.m_gameTime = null;
         this.m_requestStartTime = 0;
         this.§_-DE§ = false;
         this.§_-G9§ = null;
         this.§_-7y§ = false;
         this.§_-YJ§ = null;
      }

      private function onMainLoop(param1:TimerEvent) : void
      {
         var _loc3_:§_-1R§ = null;
         if(this.§_-2-§ > 0)
         {
            --this.§_-2-§;
            return;
         }
         var _loc2_:Number = this.m_gameTime.timeElapsed();
         if(§_-4-§.§_-NA§(_loc2_))
         {
            return;
         }
         for each(_loc3_ in this.§_-3b§)
         {
            _loc3_.onGameLoop(_loc2_);
         }
      }

      public function getModuleByName(param1:String) : §_-1R§
      {
         var _loc2_:§_-90§ = null;
         for each(_loc2_ in this.§_-3b§)
         {
            if(_loc2_.name == param1)
            {
               return _loc2_;
            }
         }
         return null;
      }

      private function §_-Hz§() : void
      {
         var _loc1_:§_-9c§ = this.view;
         if(_loc1_ != null)
         {
            _loc1_.destory();
            _loc1_ = null;
         }
         this.view = new §_-JO§(this);
      }

      public function closeWindow(param1:§_-KR§) : void
      {
         if(param1 == null)
         {
            return;
         }
         if(this.farmView != null && this.farmView.winCtrl != null)
         {
            this.farmView.winCtrl.close(param1);
         }
      }

      private function onFirstShowDIY(param1:§_-Yj§) : void
      {
         if(param1 == null || param1.target == null)
         {
            return;
         }
         param1.target.removeEventListener(§_-Ac§.MSG_SHOW_DIY,this.onFirstShowDIY);
         var _loc2_:§_-1R§ = this.getModuleByName(§_-Ac§.MODULE_DIY);
         if(_loc2_ != null && _loc2_.§_-E6§ == false)
         {
            _loc2_.load(null);
            this.dispatchEvent(new §_-Yj§(param1.type,param1.data));
         }
      }

      public function useSystemCursor(param1:Boolean) : void
      {
         if(this.farmView != null && this.farmView.cursorCtrl != null)
         {
            this.farmView.cursorCtrl.useSystem(param1);
         }
      }

      public function setExpressUser(param1:Object, param2:int) : void
      {
         if(param1["uId"] == Session.getInstance().hostId)
         {
            QzoneJSAPI.toApp(358,"");
         }
         else
         {
            QzoneJSAPI.toApp(358,com.adobe.serialization.json.JSON.encode(param1));
         }
         EventRecorder.recordErrorEvent(EventRecorder.HF_ENTERMUCHANG,1,60 + param2);
      }

      private function onFirstShowProfile(param1:§_-Yj§) : void
      {
         if(param1 == null || param1.target == null)
         {
            return;
         }
         param1.target.removeEventListener(§_-Ac§.§_-Bt§,this.onFirstShowProfile);
         var _loc2_:§_-1R§ = this.getModuleByName(§_-Ac§.§_-BB§);
         if(_loc2_ != null && _loc2_.§_-E6§ == false)
         {
            _loc2_.load(null);
            this.dispatchEvent(new §_-Yj§(param1.type,param1.data));
         }
      }

      private function onEnterPasture(param1:§_-Yj§) : void
      {
         var _loc2_:int = param1.data as int;
         var _loc3_:String = "";
         var _loc4_:Player = Session.getInstance().host;
         if(_loc4_._pf > 0)
         {
            this.setExpressUser(_loc4_.exportObject(),_loc2_);
         }
      }

      public function §_-DQ§(param1:Friend) : void
      {
         var _loc2_:Session = Session.getInstance();
         if(_loc2_.harvestAnimationPlaying == true)
         {
            return;
         }
         if(param1 == null || param1["me"] == true)
         {
            if(_loc2_.me == false)
            {
               this.farmView.cursorCtrl.setCursor(§_-Ac§.§_-7g§);
               this.useSystemCursor(true);
            }
            §_-Vz§.§_-Uv§ = "";
            this.§_-G9§ = null;
            this.§_-7y§ = true;
            this.reloadGameData("0");
         }
         else
         {
            if(!Session.getInstance().§_-Rp§)
            {
               this.farmView.cursorCtrl.setCursor(§_-Ac§.§_-7g§);
               this.useSystemCursor(true);
            }
            §_-Vz§.§_-Uv§ = param1._uin.toString();
            this.§_-G9§ = param1;
            this.§_-7y§ = false;
            this.reloadGameData(param1._uId.toString());
         }
      }

      private function onUpgradeLandError(param1:§_-Ep§) : void
      {
         var _loc2_:§_-P9§ = param1.result as §_-P9§;
         if(_loc2_ == null || _loc2_.m_extra == null)
         {
            return;
         }
         var _loc3_:* = _loc2_.m_extra;
         this.openWindowByName(§_-Ac§.§_-3r§,{
            "type":§_-Ac§.§_-MP§,
            "text":_loc3_["direction"]
         });
         if(param1.body["cmdID"] == §_-99§.§_-OP§)
         {
            this.§_-ZZ§ = null;
         }
      }

      private function onWildComplete(param1:Event) : void
      {
         var _loc2_:Class = Utils.getClass("wild.com.Shell.WildShell");
         if(_loc2_)
         {
            this.wildShell = new _loc2_();
            this.wildShell.initConfig(this.beastAPI);
         }
      }

      private function §_-1c§(param1:int, param2:int, param3:int = -1, param4:Boolean = false) : void
      {
         var _loc5_:* = null;
         if(param1 == 0)
         {
            if(param2 == 0)
            {
               _loc5_ = Utils.buildRequest(§_-99§.§_-Mz§,{"confirm":1});
            }
            else
            {
               this.§_-7l§ = null;
               _loc5_ = Utils.buildRequest(§_-99§.§_-OP§,{
                  "shopType":§_-Ac§.§_-QN§,
                  "itemType":§_-Ac§.§_-QN§,
                  "itemId":param3,
                  "itemNum":1
               });
            }
            §_-En§(§_-Vf§.§_-Oh§,_loc5_,"",null,this.onUpgradeLandSuccess,this.onUpgradeLandError);
         }
         else if(param4 == false || param2 == 1)
         {
            if(param2 == 0)
            {
               _loc5_ = Utils.buildRequest(§_-99§.§_-L6§,{"op":1});
            }
            else
            {
               this.§_-ZZ§ = null;
               _loc5_ = Utils.buildRequest(§_-99§.§_-OP§,{
                  "shopType":§_-Ac§.§_-Xo§,
                  "itemType":§_-Ac§.§_-Xo§,
                  "itemId":param3,
                  "itemNum":1
               });
            }
            §_-En§(§_-Vf§.§_-Oh§,_loc5_,"",null,this.onUpgradeLandSuccess,this.onUpgradeLandError);
         }
         else
         {
            this.openWindowByName(§_-Ac§.§_-7i§,{
               "text":"黑土地升级进入冷却期，花费的金币价格翻倍，您确定还要升级么？",
               "title":"升级黑土地",
               "confirmFn":this.§_-8W§
            });
         }
      }

      private function §_-8W§() : void
      {
         var _loc1_:* = Utils.buildRequest(§_-99§.§_-L6§,{"op":1});
         §_-En§(§_-Vf§.§_-Oh§,_loc1_,"",null,this.onUpgradeLandSuccess,this.onUpgradeLandError);
      }

      public function closeWindowByName(param1:String) : void
      {
         if(param1 == null || param1 == "")
         {
            return;
         }
         if(this.farmView != null && this.farmView.winCtrl != null)
         {
            this.farmView.winCtrl.closeForName(param1);
         }
      }

      public function openFloat(param1:String, param2:int = 0, param3:Object = null) : void
      {
         if(param1 == null || param1.length == 0)
         {
            return;
         }
         if(this.farmView != null && this.farmView.floatCtrl != null)
         {
            this.farmView.floatCtrl.open(param1,0,param3);
         }
      }

      private function onReloadGameData(param1:§_-Yj§) : void
      {
         if(param1 == null || param1.data == null)
         {
            return;
         }
         this.reloadGameData(param1.data["ownerId"]);
      }

      private function onFirstShowMyPack(param1:§_-Yj§) : void
      {
         if(param1 == null || param1.target == null)
         {
            return;
         }
         param1.target.removeEventListener(§_-Ac§.§_-EJ§,this.onFirstShowMyPack);
         param1.target.removeEventListener(§_-Ac§.§_-Rl§,this.onFirstShowMyPack);
         var _loc2_:§_-5w§ = this.farmView.getLayerByName(§_-Ac§.§_-8p§);
         var _loc3_:§_-1R§ = this.getModuleByName(§_-Ac§.§_-EI§);
         if(_loc3_ != null && _loc3_.§_-E6§ == false)
         {
            _loc3_.load(_loc2_);
            this.dispatchEvent(new §_-Yj§(param1.type,param1.data));
         }
      }

      private function onUpgradeLandSuccess(param1:§_-Ep§) : void
      {
         var _loc4_:* = undefined;
         var _loc2_:§_-P9§ = param1.result as §_-P9§;
         if(_loc2_ == null || _loc2_.m_extra == null)
         {
            return;
         }
         var _loc3_:* = _loc2_.m_extra;
         if(_loc3_["code"] == 1)
         {
            if(param1.body["cmdID"] == §_-99§.§_-OP§)
            {
               _loc4_ = null;
               if(param1.body["__body"]["shopType"] == §_-Ac§.§_-QN§)
               {
                  this.§_-7l§ = _loc3_;
                  _loc4_ = Utils.buildRequest(§_-99§.§_-PE§,{
                     "itemId":param1.body["__body"]["itemId"],
                     "itemNum":1,
                     "itemType":§_-Ac§.§_-QN§,
                     "payType":§_-Ac§.§_-EN§,
                     "shopType":§_-Ac§.§_-QN§
                  });
                  §_-En§(§_-Vf§.§_-Oh§,_loc4_,"",null,this.onRedUpgradeInGame,this.onRedUpgradeInGame);
               }
               else
               {
                  this.§_-ZZ§ = _loc3_;
                  _loc4_ = Utils.buildRequest(§_-99§.§_-PE§,{
                     "itemId":param1.body["__body"]["itemId"],
                     "itemNum":1,
                     "itemType":§_-Ac§.§_-Xo§,
                     "payType":§_-Ac§.§_-EN§,
                     "shopType":§_-Ac§.§_-Xo§
                  });
                  §_-En§(§_-Vf§.§_-Oh§,_loc4_,"",null,this.onBlackUpgradeInGame,this.onBlackUpgradeInGame);
               }
            }
            else
            {
               Session.getInstance().updateHostAccount(_loc3_["money"],0,0);
               if(param1.body["cmdID"] == §_-99§.§_-Mz§)
               {
                  _loc3_["red"] = true;
               }
               if(param1.body["cmdID"] == §_-99§.§_-L6§)
               {
                  this.showBlackUpgradeShare(_loc3_);
               }
               this.dispatchEvent(new §_-Yj§(§_-Ac§.§_-D-§,_loc3_));
            }
         }
         else if(_loc3_["code"] == -30341 || _loc3_["ecode"] == -30341)
         {
            if(param1.body["cmdID"] == §_-99§.§_-L6§)
            {
               _loc3_["black"] = true;
               _loc3_["error"] = "不是空地，无法升级为黑土地";
               this.dispatchEvent(new §_-Yj§(§_-Ac§.§_-D-§,_loc3_));
            }
         }
      }

      public function dispatchEvent(param1:Event) : void
      {
         if(this.§_-Q2§ != null)
         {
            this.§_-Q2§.dispatchEvent(param1);
            return;
         }
         throw new Error("Application not initialize");
      }

      public function processNetException() : void
      {
         var _loc1_:§_-90§ = null;
         this.dispatchEvent(new §_-Yj§(§_-Ac§.§_-Y-§,{"showLoading":false}));
         this.startMainLoop();
         if(this.§_-DE§ == true)
         {
            this.§_-DE§ = false;
         }
         for each(_loc1_ in this.§_-3b§)
         {
            _loc1_.onNetRequestStopped();
         }
      }

      private function onFreeGift(param1:§_-Yj§) : void
      {
         if(param1 == null || param1.target == null)
         {
            return;
         }
         param1.target.removeEventListener(§_-Ac§.§_-CK§,this.onFreeGift);
         var _loc2_:§_-1R§ = this.getModuleByName(§_-Ac§.§_-k§);
         if(_loc2_ != null && _loc2_.§_-E6§ == false)
         {
            _loc2_.load(null);
            this.dispatchEvent(new §_-Yj§(param1.type,param1.data));
         }
      }

      private function onFirstShowShop(param1:§_-Yj§) : void
      {
         if(param1 == null || param1.target == null)
         {
            return;
         }
         param1.target.removeEventListener(§_-Ac§.§_-P1§,this.onFirstShowShop);
         var _loc2_:§_-1R§ = this.getModuleByName(§_-Ac§.§_-OU§);
         if(_loc2_ != null && _loc2_.§_-E6§ == false)
         {
            _loc2_.load(null);
            this.dispatchEvent(new §_-Yj§(param1.type,param1.data));
         }
      }

      private function onFirstOpenSellItemWindow(param1:§_-Yj§) : void
      {
         if(param1 == null || param1.target == null)
         {
            return;
         }
         param1.target.removeEventListener(§_-Ac§.§_-5F§,this.onFirstOpenSellItemWindow);
         var _loc2_:§_-1R§ = this.getModuleByName(§_-Ac§.§_-EI§);
         if(_loc2_ != null && _loc2_.§_-E6§ == false)
         {
            _loc2_.load(null);
            this.dispatchEvent(new §_-Yj§(param1.type,param1.data));
         }
      }

      private function onCheckRequestError(param1:§_-Yj§) : void
      {
         if(param1 == null || param1.data == null)
         {
            return;
         }
         var _loc2_:* = param1.data;
         if(_loc2_["cmdID"] == §_-99§.CMD_RELOAD_GAME_DATA)
         {
            this.dispatchEvent(new §_-Yj§(§_-Ac§.§_-Y-§,{"showLoading":false}));
            this.startMainLoop();
            this.§_-G9§ = null;
            this.§_-7y§ = false;
         }
         this.openWindowByName(§_-Ac§.§_-W4§,{"url":_loc2_["url"]});
      }

      public function removeEventListener(param1:String, param2:Function) : void
      {
         if(this.§_-Q2§ != null)
         {
            this.§_-Q2§.removeEventListener(param1,param2);
            return;
         }
         throw new Error("Application not initialize");
      }

      private function showBlackUpgradeShare(param1:Object) : void
      {
         var _loc2_:int = 0;
         if(param1 == null)
         {
            return;
         }
         param1["black"] = true;
         if(param1["rank"] > 0)
         {
            _loc2_ = param1["rank"] % 10;
            if(param1["place"] == 0 || _loc2_ == 0 || _loc2_ == 1 || _loc2_ == 5 || _loc2_ == 6 || _loc2_ == 8 || _loc2_ == 9)
            {
               if(this.§_-YJ§ == null)
               {
                  this.§_-YJ§ = new §_-78§(this as §_-3§);
               }
               this.§_-YJ§.data = {
                  "place":param1["place"],
                  "rank":param1["rank"]
               };
               this.openWindow(this.§_-YJ§);
            }
         }
      }

      public function addEventListener(param1:String, param2:Function, param3:Boolean = false, param4:int = 0, param5:Boolean = false) : void
      {
         if(this.§_-Q2§ != null)
         {
            this.§_-Q2§.addEventListener(param1,param2,param3,param4,param5);
            return;
         }
         throw new Error("Application not initialize");
      }

      private function onFirstOpenBuyItemWindow(param1:§_-Yj§) : void
      {
         if(param1 == null || param1.target == null)
         {
            return;
         }
         param1.target.removeEventListener(§_-Ac§.§_-ZL§,this.onFirstOpenBuyItemWindow);
         param1.target.removeEventListener(§_-Ac§.§_-KQ§,this.onFirstOpenBuyItemWindow);
         var _loc2_:§_-1R§ = this.getModuleByName(§_-Ac§.§_-OU§);
         if(_loc2_ != null && _loc2_.§_-E6§ == false)
         {
            _loc2_.load(null);
            this.dispatchEvent(new §_-Yj§(param1.type,param1.data));
         }
      }

      private function §_-ZM§() : void
      {
         var _loc1_:Loader = new Loader();
         var _loc2_:LoaderContext = new LoaderContext();
         _loc2_.applicationDomain = CommonData.applicationDomain;
         _loc1_.contentLoaderInfo.addEventListener(Event.COMPLETE,this.onWildComplete);
         var _loc3_:String = Utils.addPrefix(Settings.getInstance().getStringAttribute("beastLoaderUrl"));
         _loc1_.load(new URLRequest(_loc3_),_loc2_);
      }

      private function onShowUpgradeRedWindow(param1:Event) : void
      {
         var _loc4_:Boolean = false;
         var _loc2_:§_-2b§ = this.getModuleByName(§_-Ac§.§_-Hv§) as §_-2b§;
         if(_loc2_ != null)
         {
            _loc4_ = _loc2_.isAllBlack;
            if(_loc4_ == true)
            {
               this.openWindowByName(§_-Ac§.§_-VH§,{
                  "ecode":-30120,
                  "allBlack":_loc4_
               });
               return;
            }
         }
         if(this.§_-DE§ == true)
         {
            return;
         }
         var _loc3_:* = Utils.buildRequest(§_-99§.§_-Mz§,null);
         §_-En§(§_-Vf§.§_-Oh§,_loc3_,"",null,this.onUpgradeRedCondition,this.onUpgradeRedConditionError);
         this.§_-DE§ = true;
      }

      private function checkWildDataStatus(param1:Object) : void
      {
         var _loc4_:Array = null;
         var _loc2_:Array = param1["info"];
         var _loc3_:int = 0;
         while(_loc3_ < _loc2_.length)
         {
            _loc4_ = _loc2_[_loc3_]["attack"];
            if(this.§_-5U§(_loc4_) == false && _loc2_[_loc3_]["fid"] != Session.getInstance().host.fid && _loc2_[_loc3_]["status"] != 6)
            {
               return;
            }
            _loc3_++;
         }
         this.dispatchEvent(new §_-Yj§(§_-Ac§.§_-Ad§,{
            "t":0,
            "uId":Session.getInstance().currentUserIdByUinMode
         }));
      }

      private function onReloadGameFailed(param1:§_-Ep§) : void
      {
         var _loc4_:String = null;
         if(param1 == null)
         {
            return;
         }
         var _loc2_:§_-P9§ = param1.result as §_-P9§;
         if(_loc2_ == null)
         {
            return;
         }
         this.dispatchEvent(new §_-Yj§(§_-Ac§.§_-Y-§,{"showLoading":false}));
         this.startMainLoop();
         this.§_-G9§ = null;
         this.§_-7y§ = false;
         var _loc3_:* = _loc2_.m_extra;
         if(_loc3_ != null && _loc3_["errorType"] != undefined)
         {
            _loc4_ = _loc3_["errorType"];
            if(_loc4_ == "limitCode")
            {
               this.openWindowByName(§_-Ac§.§_-3r§,{
                  "type":§_-Ac§.§_-MP§,
                  "text":§_-4Y§.§_-Kf§["请求超时，稍后再试"]
               });
            }
            else
            {
               this.openWindowByName(§_-Ac§.§_-3r§,{
                  "type":§_-Ac§.§_-MP§,
                  "text":"无法访问服务器"
               });
            }
         }
      }

      private function §_-XS§(param1:Object) : void
      {
         if(param1 == null)
         {
            return;
         }
         var _loc2_:Array = [];
         if(param1.hasOwnProperty("item") == true)
         {
            _loc2_ = _loc2_.concat(param1["item"]);
         }
         if(param1.hasOwnProperty("vipItem") == true && param1["vipItem"] != false)
         {
            _loc2_ = _loc2_.concat(param1["vipItem"]);
         }
         Session.getInstance().§_-WD§(_loc2_);
      }

      public function openWindow(param1:§_-KR§) : void
      {
         if(param1 == null)
         {
            return;
         }
         if(this.farmView != null && this.farmView.winCtrl != null)
         {
            this.farmView.winCtrl.open(param1);
         }
      }

      private function onReloadGameSuccess(param1:§_-Ep§) : void
      {
         var _loc3_:§_-UU§ = null;
         var _loc8_:Object = null;
         var _loc2_:§_-P9§ = param1.result as §_-P9§;
         if(_loc2_ == null)
         {
            return;
         }
         _loc3_ = _loc2_.m_extra as §_-UU§;
         if(_loc3_ == null)
         {
            return;
         }
         this.dispatchEvent(new §_-Yj§(§_-Ac§.§_-Y-§,{"showLoading":false}));
         this.startMainLoop();
         if(_loc3_._user._healthMode._serverTime != 0)
         {
            CommonData.serverTime = _loc3_._user._healthMode._serverTime;
         }
         var _loc4_:int = getTimer() - this.m_requestStartTime;
         var _loc5_:Session = Session.getInstance();
         _loc5_.§_-Bj§ = _loc3_._dog._isHungry > 0;
         _loc5_.§_-Nc§ = _loc3_._welcome;
         var _loc6_:Object = _loc3_.§_-Rx§;
         if(_loc6_ != null)
         {
            if(_loc3_._dog != null)
            {
               _loc6_[§_-Ac§.§_-CW§.toString()] = {"itemId":_loc3_._dog._dogId};
            }
            _loc5_.§_-CO§ = _loc6_;
         }
         var _loc7_:Player = null;
         if(this.§_-7y§ == true)
         {
            _loc7_ = _loc5_.host;
            if(_loc3_._user != null)
            {
               _loc7_._pf = _loc3_._user._pf;
               _loc7_._healthMode = _loc3_._user._healthMode;
               _loc7_._moralExp = _loc3_._user._moralExp;
               if(_loc3_._user._exp > 0 && !_loc5_.§_-8-§)
               {
                  _loc7_._exp = _loc3_._user._exp;
               }
            }
            _loc5_.host = _loc7_;
         }
         else
         {
            if(this.§_-G9§ == null)
            {
               §_-B9§.log("Exception in app, switch to a null player.");
               return;
            }
            _loc7_ = new Player(null);
            if(_loc3_._user != null)
            {
               _loc7_._pf = _loc3_._user._pf;
               _loc7_._healthMode = _loc3_._user._healthMode;
               _loc7_._moralExp = _loc3_._user._moralExp;
               if(_loc3_._user._exp > 0)
               {
                  _loc7_._exp = _loc3_._user._exp;
               }
            }
            _loc7_._uId = this.§_-G9§._uId;
            _loc7_.uin = this.§_-G9§._uin;
            _loc7_._uinLogin = this.§_-G9§._uin;
            _loc7_._userName = this.§_-G9§._userName;
            _loc7_._money = this.§_-G9§._money;
            _loc7_._headPic = this.§_-G9§._headPic;
            _loc7_._yellowlevel = this.§_-G9§._yellowlevel;
            _loc7_._yellowstatus = this.§_-G9§._yellowstatus;
            _loc7_.me = false;
         }
         _loc5_.currentUser = _loc7_;
         _loc5_.m_lockFishMouse = false;
         this.dispatchEvent(new §_-Yj§(§_-Ac§.§_-6C§,_loc3_));
         if(_loc3_.hasOwnProperty("gift") == true)
         {
            _loc8_ = _loc3_["gift"];
            _loc8_["big"] = true;
            this.openWindowByName(§_-Ac§.§_-LP§,_loc8_);
            this.§_-XS§(_loc3_["gift"]);
         }
         if(_loc3_._beast)
         {
            if(!this.beastAPI)
            {
               BeastAPI.app = this;
               this.beastAPI = BeastAPI.getInstance();
               this.beastAPI.beastConfigUrl = Settings.getInstance().wildCfgUrl;
               this.beastAPI.§_-Tv§();
            }
            this.beastAPI.beastBase = _loc3_._beast;
            if(!this.wildShell)
            {
               this.§_-ZM§();
            }
            this.checkWildDataStatus(_loc3_._beast);
         }
      }

      public function showTip(param1:String, param2:Object) : void
      {
         if(param1 == null || param1.length == 0)
         {
            return;
         }
         if(param2 == null)
         {
            return;
         }
         if(this.farmView != null && this.farmView.tipCtrl != null)
         {
            this.farmView.tipCtrl.show(param1,param2);
         }
      }

      private function onUpgradeRedConditionError(param1:§_-Ep§) : void
      {
         this.§_-DE§ = false;
         var _loc2_:§_-P9§ = param1.result as §_-P9§;
         if(_loc2_ == null || _loc2_.m_extra == null)
         {
            return;
         }
         var _loc3_:* = _loc2_.m_extra;
         this.openWindowByName(§_-Ac§.§_-3r§,{
            "type":§_-Ac§.§_-MP§,
            "text":_loc3_["direction"]
         });
      }

      private function onFirstBlogGame(param1:§_-Yj§) : void
      {
         if(param1 == null || param1.target == null)
         {
            return;
         }
         param1.target.removeEventListener(§_-Ac§.§_-Bq§,this.onFirstShowRecall);
         var _loc2_:§_-1R§ = this.getModuleByName(§_-Ac§.§_-Jm§);
         if(_loc2_ != null && _loc2_.§_-E6§ == false)
         {
            _loc2_.load(null);
            this.dispatchEvent(new §_-Yj§(param1.type,param1.data));
         }
      }

      private function onFirstShowRecall(param1:§_-Yj§) : void
      {
         if(param1 == null || param1.target == null)
         {
            return;
         }
         param1.target.removeEventListener(§_-Ac§.§_-Vw§,this.onFirstShowRecall);
         var _loc2_:§_-1R§ = this.getModuleByName(§_-Ac§.§_-PG§);
         if(_loc2_ != null && _loc2_.§_-E6§ == false)
         {
            _loc2_.load(null);
            this.dispatchEvent(new §_-Yj§(param1.type,param1.data));
         }
      }

      private function onUpgradeRedCondition(param1:§_-Ep§) : void
      {
         this.§_-DE§ = false;
         var _loc2_:§_-P9§ = param1.result as §_-P9§;
         if(_loc2_ == null || _loc2_.m_extra == null)
         {
            return;
         }
         var _loc3_:* = _loc2_.m_extra;
         this.openWindowByName(§_-Ac§.§_-VH§,{
            "text":_loc3_["direction"],
            "money":_loc3_["money"],
            "qd":_loc3_["qd"],
            "yqd":_loc3_["yqd"],
            "place":_loc3_["place"],
            "ecode":_loc3_["ecode"],
            "confirmFn":this.§_-1c§,
            "allBlack":_loc3_["allBlack"]
         });
      }

      private function onRedUpgradeInGame(param1:§_-Ep§) : void
      {
         var data:*;
         var onPaySuccess:Function = null;
         var e:§_-Ep§ = param1;
         onPaySuccess = function(param1:Object):void
         {
            if(§_-7l§ != null)
            {
               dispatchEvent(new §_-Yj§(§_-Ac§.§_-D-§,{
                  "red":true,
                  "place":§_-7l§["place"],
                  "output":§_-7l§["output"],
                  "leavings":§_-7l§["leavings"],
                  "min":§_-7l§["min"]
               }));
            }
            §_-7l§ = null;
         };
         var vo:§_-P9§ = e.result as §_-P9§;
         if(vo == null || vo.m_extra == null)
         {
            return;
         }
         data = vo.m_extra;
         if(data["ecode"] == 0)
         {
            if(data["local"] == 1)
            {
               onPaySuccess(data);
            }
            else
            {
               QzoneJSAPI.getInGamePay(data["url_params"],onPaySuccess);
            }
         }
         else
         {
            this.openWindowByName(§_-Ac§.§_-3r§,{
               "type":§_-Ac§.§_-MP§,
               "text":data["direction"]
            });
         }
      }

      private function onSwitchUser(param1:§_-Yj§) : void
      {
         var _loc3_:Friend = null;
         if(param1 == null)
         {
            return;
         }
         var _loc2_:* = param1.data;
         if(_loc2_ != null && _loc2_.hasOwnProperty("__reload__") == true && _loc2_["__reload__"] == true)
         {
            if(this.§_-G9§ == null)
            {
               this.reloadGameData("0");
            }
            else
            {
               this.reloadGameData(this.§_-G9§._uId.toString());
            }
         }
         else
         {
            _loc3_ = param1.data as Friend;
            this.§_-DQ§(_loc3_);
         }
      }

      private function §_-5U§(param1:Array) : Boolean
      {
         var _loc2_:int = 0;
         while(_loc2_ < param1.length)
         {
            if(param1[_loc2_]["fid"] == Session.getInstance().host.fid)
            {
               return true;
            }
            _loc2_++;
         }
         return false;
      }

      private function reloadGameData(param1:String) : void
      {
         var _loc2_:* = {"ownerId":param1};
         if(param1 == "0")
         {
            _loc2_["flag"] = "1";
         }
         this.m_requestStartTime = getTimer();
         var _loc3_:* = Utils.buildRequest(§_-99§.CMD_RELOAD_GAME_DATA,_loc2_);
         §_-En§(§_-Vf§.§_-Oh§,_loc3_,"",null,this.onReloadGameSuccess,this.onReloadGameFailed);
         this.dispatchEvent(new §_-Yj§(§_-Ac§.§_-Y-§,{"showLoading":true}));
         if(this.m_mainLoop != null)
         {
            this.m_mainLoop.stop();
         }
      }

      public function hideTip() : void
      {
         if(this.farmView != null && this.farmView.tipCtrl != null)
         {
            this.farmView.tipCtrl.hide();
         }
      }

      private function onBlackUpgradeInGame(param1:§_-Ep§) : void
      {
         var data:*;
         var onPaySuccess:Function = null;
         var e:§_-Ep§ = param1;
         onPaySuccess = function(param1:Object):void
         {
            if(§_-ZZ§ != null)
            {
               dispatchEvent(new §_-Yj§(§_-Ac§.§_-D-§,{
                  "black":true,
                  "place":§_-ZZ§["place"],
                  "output":0,
                  "leavings":0,
                  "min":0
               }));
            }
            §_-ZZ§ = null;
         };
         var vo:§_-P9§ = e.result as §_-P9§;
         if(vo == null || vo.m_extra == null)
         {
            return;
         }
         data = vo.m_extra;
         if(data["ecode"] == 0)
         {
            if(data["local"] == 1)
            {
               onPaySuccess(data);
            }
            else
            {
               QzoneJSAPI.getInGamePay(data["url_params"],onPaySuccess);
            }
         }
         else
         {
            this.openWindowByName(§_-Ac§.§_-3r§,{
               "type":§_-Ac§.§_-MP§,
               "text":data["direction"]
            });
         }
      }

      public function get farmView() : §_-JO§
      {
         return this.view as §_-JO§;
      }

      public function openWindowByName(param1:String, param2:Object) : void
      {
         if(param1 == null || param1.length == 0)
         {
            return;
         }
         if(this.farmView != null && this.farmView.winCtrl != null)
         {
            this.farmView.winCtrl.openForName(param1,param2);
         }
      }

      public function startup() : void
      {
         var _loc1_:§_-90§ = null;
         var _loc2_:§_-5w§ = null;
         this.§_-Hz§();
         this.farmView.init();
         this.§_-BL§ = new FarmAPI(this);
         §_-20§.getInstance().§_-2t§(this.§_-BL§);
         if(this.§_-3b§ == null)
         {
            this.§_-3b§ = new Array();
            _loc1_ = new §_-2b§(this);
            _loc2_ = this.farmView.getLayerByName(§_-Ac§.§_-Xp§);
            _loc1_.load(_loc2_);
            this.§_-3b§.push(_loc1_);
            _loc1_ = new §_-5z§(this);
            _loc2_ = this.farmView.getLayerByName(§_-Ac§.§_-8p§);
            _loc1_.load(_loc2_);
            this.§_-3b§.push(_loc1_);
            _loc1_ = new ModuleWarehouse(this);
            this.§_-3b§.push(_loc1_);
            this.addEventListener(§_-Ac§.§_-EJ§,this.onFirstShowMyPack,false,0,true);
            this.addEventListener(§_-Ac§.§_-Rl§,this.onFirstShowMyPack,false,0,true);
            _loc1_ = new ModuleShop(this);
            this.§_-3b§.push(_loc1_);
            this.addEventListener(§_-Ac§.§_-P1§,this.onFirstShowShop,false,0,true);
            _loc1_ = new §_-XA§(this);
            this.§_-3b§.push(_loc1_);
            this.addEventListener(§_-Ac§.MSG_SHOW_DIY,this.onFirstShowDIY,false,0,true);
            _loc1_ = new §_-Tm§(this);
            _loc2_ = this.farmView.getLayerByName(§_-Ac§.§_-2x§);
            _loc1_.load(_loc2_);
            this.§_-3b§.push(_loc1_);
            _loc1_ = new §_-Mn§(this);
            this.§_-3b§.push(_loc1_);
            this.addEventListener(§_-Ac§.§_-Bt§,this.onFirstShowProfile,false,0,true);
            _loc1_ = new §_-WX§(this);
            _loc1_.load(null);
            this.§_-3b§.push(_loc1_);
            _loc1_ = new §_-Z2§(this);
            _loc2_ = this.farmView.getLayerByName(§_-Ac§.§_-Jq§);
            _loc1_.load(_loc2_);
            this.§_-3b§.push(_loc1_);
            _loc1_ = new §_-3X§(this);
            this.§_-3b§.push(_loc1_);
            this.addEventListener(§_-Ac§.§_-Vw§,this.onFirstShowRecall,false,0,true);
            _loc1_ = new §_-Bm§(this);
            this.§_-3b§.push(_loc1_);
            this.addEventListener(§_-Ac§.§_-CK§,this.onFreeGift,false,0,true);
            _loc1_ = new §_-7V§(this);
            _loc1_.load(null);
            this.§_-3b§.push(_loc1_);
            _loc1_ = new ModuleCardsGame(this);
            _loc1_.load(null);
            this.§_-3b§.push(_loc1_);
         }
         this.addEventListener(§_-Ac§.§_-WP§,this.onSwitchUser,false,0,true);
         this.addEventListener(§_-Ac§.MSG_RELOAD_GAME_DATA,this.onReloadGameData,false,0,true);
         this.addEventListener(§_-Ac§.§_-2i§,this.onShowUpgradeRedWindow,false,0,true);
         this.addEventListener(§_-Ac§.§_-9B§,this.onCheckRequestError,false,0,true);
         this.addEventListener(§_-Ac§.§_-ZL§,this.onFirstOpenBuyItemWindow,false,0,true);
         this.addEventListener(§_-Ac§.§_-KQ§,this.onFirstOpenBuyItemWindow,false,0,true);
         this.addEventListener(§_-Ac§.§_-5F§,this.onFirstOpenSellItemWindow,false,0,true);
         this.addEventListener(§_-Ac§.§_-4x§,this.onEnterPasture,false,0,true);
         this.m_mainLoop = new Timer(§_-Ac§.§_-C7§,0);
         this.m_mainLoop.addEventListener(TimerEvent.TIMER,this.onMainLoop);
         this.m_mainLoop.start();
         this.m_gameTime = new GameTime(false);
         this.m_gameTime.start();
         §_-Im§.instance().container = this.farmView.getLayerByName(§_-Ac§.§_-4F§);
         UserActionRecorder.recordAction(UserActionRecorder.HF_GAME_INIT);
      }

      private function startMainLoop() : void
      {
         if(this.m_mainLoop != null && this.m_mainLoop.running == false)
         {
            this.m_mainLoop.reset();
            this.m_mainLoop.start();
            if(this.m_gameTime != null)
            {
               this.m_gameTime.start();
            }
         }
      }
   }
}
