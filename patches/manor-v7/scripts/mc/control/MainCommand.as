package mc.control
{
   import com.adobe.serialization.json.*;
   import com.adobe.utils.StringUtil;
   import com.lipi.LipiUtil;
   import com.qzone.corelib.js.JSProxy;
   import com.qzone.qui.managers.PopUpManager;
   import com.qzone.utils.CookieUtil;
   import common.CommonData;
   import common.INI;
   import common.LocalData;
   import common.MaterialLib;
   import flash.display.Loader;
   import flash.display.LoaderInfo;
   import flash.display.MovieClip;
   import flash.display.Sprite;
   import flash.events.Event;
   import flash.events.EventDispatcher;
   import flash.events.IOErrorEvent;
   import flash.events.TimerEvent;
   import flash.external.ExternalInterface;
   import flash.net.LocalConnection;
   import flash.net.URLRequest;
   import flash.net.sendToURL;
   import flash.system.Security;
   import flash.text.TextField;
   import flash.text.TextFieldAutoSize;
   import flash.text.TextFormat;
   import flash.text.TextFormatAlign;
   import flash.utils.Timer;
   import flash.utils.getTimer;
   import flash.utils.setTimeout;
   import gs.TweenLite;
   import mc.FBridge.EventRecorder;
   import mc.FBridge.FRequest;
   import mc.FBridge.FeartureManager;
   import mc.FBridge.RequestManager;
   import mc.api.BeastAPI;
   import mc.api.WildData;
   import mc.events.GameEvent;
   import mc.events.WindowEvent;
   import mc.model.FarmData;
   import mc.model.MData;
   import mc.model.MainData;
   import mc.model.OpenControl;
   import mc.model.ProductData;
   import mc.model.TaskData;
   import mc.model.ToolData;
   import mc.submoudule.monthBegin.MonthBeginEvent;
   import mc.submoudule.monthBegin.MonthBeginModel;
   import mc.view.CropLoader;
   import mc.view.common.BaseWindow;
   import mc.view.common.HtmlTextWindow;
   import mc.view.common.InfoWindow;
   import mc.view.common.Language;
   import mc.view.farm.GetCropID;
   import mc.view.farm.MPScene;
   import mc.view.farm.Research.ResearchEvent;
   import mc.view.farm.Research.ResearchModel;
   import mc.view.farm.land.GrassCutter;
   import mc.view.main.WindowControl.WControl;
   import mc.view.main.WindowControl.WindowClassLib;
   import mc.view.main.cursor.Cursor;
   import mc.view.main.friend.Friend;
   import mc.view.main.game.ValidateCodeWindow;
   import mc.view.main.head.Weather;
   import mc.view.proxy.GameProxy;

   public class MainCommand extends EventDispatcher
   {

      public static var requestUID:String;

      private static var getVipReturnGift:Boolean = true;

      private var testT:Number;

      private var useshengchanCursor:Boolean = false;

      private var lastTip:Sprite;

      private var _taskData:Object;

      private var _neddUpdateHead:Boolean = false;

      private var isFirstLoadSysMsg:Boolean = false;

      private var _friends:Array;

      private var _both:Boolean = false;

      private var oldData:Array = null;

      private var buyTime:int;

      private var canUseAllCursor:Boolean = false;

      private var requestStartTime:Number;

      private var setUserData:Object;

      private var farmlandTimer:Timer;

      private var expServerTime:Number;

      private var _itemId:String;

      private var fr:FRequest;

      private var version:String;

      private var cftRequest:String;

      private var preBuyToolType:int = 0;

      private var buyDiyData:Object = {};

      private var _tempMaterial:Array;

      private var _tasking:Boolean = false;

      private var mainData:MainData;

      private var farmData:FarmData;

      private var _wildShell:*;

      private var _tempCrystal:Array;

      private var _expAlertTip:Boolean;

      private var changeLC:LocalConnection;

      private var _loader:Loader;

      private var _postValue:Object = {};

      private var cftPostValue:Object;

      private var cacheSeedsData:Object;

      private var profile:Object = {};

      private var preBuyThingType:int = 0;

      private var localData:LocalData;

      private var _beastapi:BeastAPI;

      private var firstRun:Boolean = true;

      private var historyCallBackFn:Function;

      private var taskList:Object = {
         "0":{"name":"help"},
         "1":{"name":"shourou"},
         "2":{"name":"goumai"},
         "3":{"name":"mucao1"},
         "4":{"name":"shengchan1"},
         "5":{"name":"shouhuo"},
         "6":{"name":"maichu"},
         "7":{"name":"mucao2"},
         "8":{"name":"shengchan2"},
         "9":{"name":"touqie"}
      };

      private var cropsLoader:CropLoader;

      private var expError:Boolean = false;

      public function MainCommand()
      {
         super();
         this.fr = FRequest.getInstance();
         this.mainData = MData.getInstance().mainData;
         this.farmData = MData.getInstance().farmData;
         this.farmlandTimer = new Timer(1000);
         this.farmlandTimer.addEventListener(TimerEvent.TIMER,this.timerHandler);
         this.farmlandTimer.start();
         RequestManager.getInstance().registerAction();
         this.localData = LocalData.getInstance();
         this._expAlertTip = false;
         GameProxy.iniData = INI.getInstance().data;
         GameProxy.parameters = LocalData.parameters;
         GameProxy.getInstance().addEventListener(GameEvent.ADD_MONEY,this.addGameMoney);
         if(Version.value == "qzone")
         {
            this.version = "qzone.qq";
         }
         else if(Version.value == "")
         {
            if(LocalData.xymode == "")
            {
               this.version = "";
            }
            else
            {
               this.version = "";
            }
         }
      }

      public static function getModule2Url(param1:String) : Object
      {
         var moduleName:String = param1;
         var returnValue:Object = new Object();
         var iniData:Object = INI.getInstance().data;
         if(iniData != null)
         {
            returnValue["url"] = iniData.moduleList2.module.(@name == moduleName).@url;
         }
         if(returnValue["url"])
         {
            returnValue["url"] = GetCropID.addPrefix(returnValue["url"]);
         }
         if(returnValue == "")
         {
            throw new Error("模块地址出错" + moduleName);
         }
         return returnValue;
      }

      public function updateWildStatus(param1:Number) : void
      {
         var _loc4_:Object = null;
         var _loc2_:Number = Number(this.mainData.currentUser["uId"]);
         var _loc3_:Object = this.mainData.friendStatus;
         if(Boolean(_loc3_) && Boolean(_loc3_[_loc2_]))
         {
            _loc4_ = _loc3_[_loc2_];
         }
         if(_loc4_)
         {
            _loc4_["udo"] = 0;
            if(param1 != 0)
            {
               _loc4_["u"] = param1;
            }
            this.upDateStatus(_loc2_);
         }
      }

      private function getExpFn(param1:Object) : void
      {
         var _loc2_:Array = null;
         var _loc5_:String = null;
         var _loc6_:Number = NaN;
         if(param1.hasOwnProperty("errorType"))
         {
            EventRecorder.recordErrorEvent(EventRecorder.MC_GET_EXP,getTimer() - this.requestStartTime,EventRecorder.FAULT_ERROR);
            this.expError = true;
         }
         EventRecorder.recordSueecssEvent(EventRecorder.MC_GET_EXP,getTimer() - this.requestStartTime);
         this.mainData.getFriendListLoading = false;
         this._both = false;
         this.expServerTime = param1["serverTime"];
         if(this.expError)
         {
            _loc2_ = this.localData.getObject("mc" + Version.value + this.mainData.host["uId"],1) as Array || this._friends;
         }
         else
         {
            _loc2_ = this._friends || this.localData.getObject("mc" + Version.value + this.mainData.host["uId"],1) as Array;
         }
         var _loc3_:Object = param1["userExp"];
         if(_loc3_)
         {
            for(_loc5_ in _loc2_)
            {
               _loc2_[_loc5_]["exp"] = _loc3_[_loc2_[_loc5_]["userId"] || _loc2_[_loc5_]["uId"]];
            }
            _loc6_ = CommonData.serverTime + 86400 * 3;
            this.localData.setObject("mc" + Version.value + this.mainData.host["uId"],_loc2_,_loc6_,true);
         }
         var _loc4_:Object = param1["userFlag"];
         this.mainData.friendStatus = _loc4_;
         if(_loc4_)
         {
            this.cacheStatus(_loc4_);
         }
         this.doFriendListFn(_loc2_);
      }

      private function setHostUser(param1:Object) : void
      {
         var _loc2_:Object = null;
         this.mainData.host = param1;
         this.mainData.host.me = true;
         this.mainData.host.sort = 1;
         this.mainData.currentUser = LipiUtil.clone(param1);
         this.mainData.currentUser["me"] = true;
         if(LocalData.mode == "qzone")
         {
            _loc2_ = this.localData.getObject("userName");
            if(_loc2_)
            {
               this.mainData.host.userName = _loc2_;
            }
            else
            {
               this.mainData.host.userName = JSProxy.getNickname();
            }
         }
         GameProxy.getInstance().host = this.mainData.host;
         GameProxy.getInstance().currentUser = this.mainData.host;
      }

      public function buySeed(param1:int, param2:int) : void
      {
         var _loc3_:Object = {
            "cId":param1,
            "number":param2
         };
         this.fr.postRequest("cgi_buy_animal",_loc3_,this.buySeedFn);
      }

      private function returnFn(param1:Object) : void
      {
         var _loc2_:Object = null;
         if(param1["open"] == "1")
         {
            _loc2_ = new Object();
            if(int(param1["postValue"]["appid"]) != 353)
            {
               _loc2_["payitem"] = int(param1["postValue"]["type"]) * 10000 + int(param1["postValue"]["tId"]) + "-" + param1["postValue"]["number"] + "-" + param1["postValue"]["thingName"];
               _loc2_["payType"] = 2;
               this.fr.postRequest("cgi_pasture_shop_pay",_loc2_,this.onInGamePreCheckSuccess);
            }
            else
            {
               _loc2_["shopType"] = 10;
               _loc2_["itemType"] = param1["postValue"]["type"];
               _loc2_["itemId"] = param1["postValue"]["itemID"];
               _loc2_["itemNum"] = param1["postValue"]["number"];
               _loc2_["payType"] = 2;
               this.fr.postRequest("cgi_farm_shop_pay",_loc2_,this.onInGamePreCheckSuccess);
            }
            return;
         }
         if(param1["code"] == 1)
         {
            this.buyThingByCFT(param1["postValue"]["tId"],param1["postValue"]["thingName"],param1["postValue"]["type"],param1["postValue"]["number"]);
         }
         else if(param1["errorType"] == "logic" || param1["errorType"] == "system")
         {
            this.alertWindow("error",param1["direction"]);
         }
      }

      public function friendNextEndPage(param1:String = "") : void
      {
         this.mainData.searchFriendValue = param1;
         this.mainData.showFriendPage = this.mainData.showFriendSum;
         this.pageHandler();
      }

      public function cacheStatus(param1:Object) : void
      {
         var _loc4_:String = null;
         var _loc5_:String = null;
         var _loc6_:Object = null;
         var _loc7_:int = 0;
         var _loc8_:int = 0;
         var _loc9_:int = 0;
         var _loc10_:int = 0;
         var _loc2_:Array = this._friends || this.localData.getObject("mc" + Version.value + this.mainData.host["uId"],CommonData.serverTime) as Array;
         var _loc3_:Object = this.localData.getObject("mc_status_" + Version.value + this.mainData.host["uId"]);
         if(!_loc3_)
         {
            for(_loc4_ in _loc2_)
            {
               _loc5_ = _loc2_[_loc4_]["userId"] || _loc2_[_loc4_]["uId"];
               _loc6_ = param1[_loc5_];
               if(_loc6_ != null)
               {
                  if(_loc6_["t"] != 0 && this.expServerTime > _loc6_["t"])
                  {
                     _loc6_["tdo"] = 1;
                  }
                  if(_loc6_["u"] != 0 && this.expServerTime < _loc6_["u"])
                  {
                     _loc6_["udo"] = 1;
                  }
                  if(_loc6_["g"] != 0 && this.expServerTime > _loc6_["g"])
                  {
                     _loc6_["gdo"] = 1;
                  }
                  if(_loc6_["p"] != 0 && this.expServerTime > _loc6_["p"])
                  {
                     _loc6_["pdo"] = 1;
                  }
                  if(_loc6_["b"] != 0 && this.expServerTime > _loc6_["b"])
                  {
                     _loc6_["bdo"] = 1;
                  }
               }
            }
            this.mainData.friendStatus = param1;
            this.localData.setObject("mc_status_" + Version.value + this.mainData.host["uId"],param1,0,true);
         }
         else
         {
            for(_loc4_ in _loc2_)
            {
               _loc5_ = _loc2_[_loc4_]["userId"] || _loc2_[_loc4_]["uId"];
               _loc6_ = param1[_loc5_];
               if(_loc6_ != null)
               {
                  _loc7_ = int(param1[_loc5_]["t"]);
                  _loc8_ = int(param1[_loc5_]["u"]);
                  if(_loc3_[_loc5_])
                  {
                     _loc9_ = int(_loc3_[_loc5_]["t"]);
                     _loc10_ = int(_loc3_[_loc5_]["u"]);
                     if(_loc7_ != 0)
                     {
                        if(_loc7_ > _loc9_ && this.expServerTime >= _loc7_)
                        {
                           _loc6_["tdo"] = 1;
                        }
                        else if(_loc7_ >= _loc9_ && this.expServerTime < _loc7_)
                        {
                           _loc6_["tdo"] = 2;
                        }
                        else if(_loc7_ == _loc9_ && _loc3_[_loc5_]["tdo"] != 0 && this.expServerTime >= _loc7_)
                        {
                           _loc6_["tdo"] = 1;
                        }
                        else
                        {
                           _loc6_["tdo"] = 0;
                        }
                     }
                     if(_loc8_ != 0)
                     {
                        if(_loc8_ > _loc10_ && this.expServerTime <= _loc8_)
                        {
                           _loc6_["udo"] = 1;
                        }
                        else if(_loc8_ == _loc10_ && _loc3_[_loc5_]["udo"] != 0 && this.expServerTime <= _loc8_)
                        {
                           _loc6_["udo"] = 1;
                        }
                        else
                        {
                           _loc6_["udo"] = 0;
                        }
                     }
                  }
                  if(!_loc3_[_loc5_])
                  {
                     if(_loc7_ != 0 && this.expServerTime > _loc7_)
                     {
                        _loc6_["tdo"] = 1;
                     }
                     else
                     {
                        _loc6_["tdo"] = 0;
                     }
                     if(_loc8_ != 0 && this.expServerTime < _loc8_)
                     {
                        _loc6_["udo"] = 1;
                     }
                  }
                  if(_loc6_["g"] != 0 && this.expServerTime > _loc6_["g"])
                  {
                     _loc6_["gdo"] = 1;
                  }
                  if(_loc6_["p"] != 0 && this.expServerTime > _loc6_["p"])
                  {
                     _loc6_["pdo"] = 1;
                  }
                  if(_loc6_["b"] != 0 && this.expServerTime > _loc6_["b"])
                  {
                     _loc6_["bdo"] = 1;
                  }
               }
            }
            this.mainData.friendStatus = param1;
            this.localData.setObject("mc_status_" + Version.value + this.mainData.host["uId"],param1,0,true);
         }
      }

      private function getFloatTip(param1:String, param2:String = "FloatingWindowBg") : Sprite
      {
         var _loc3_:Sprite = null;
         var _loc4_:MovieClip = null;
         var _loc5_:Boolean = false;
         var _loc6_:TextField = null;
         var _loc7_:TextFormat = null;
         if(!this.lastTip)
         {
            _loc3_ = new Sprite();
            _loc3_.mouseChildren = false;
            _loc3_.mouseEnabled = false;
            _loc4_ = MaterialLib.getInstance().getMaterial(param2) as MovieClip;
            _loc3_.addChild(_loc4_);
            _loc5_ = false;
            if(param1.indexOf("<br") != -1)
            {
               _loc5_ = true;
            }
            _loc7_ = new TextFormat(null,14,8999699,null,null,null,null,null,TextFormatAlign.LEFT);
            _loc7_.leading = _loc5_ ? 3 : 8;
            _loc6_ = new TextField();
            _loc6_.selectable = false;
            _loc6_.defaultTextFormat = _loc7_;
            _loc6_.width = 230;
            _loc6_.x = 45;
            _loc6_.y = _loc5_ ? 3 : 13;
            _loc6_.wordWrap = true;
            _loc6_.multiline = true;
            _loc6_.htmlText = param1;
            _loc6_.autoSize = TextFieldAutoSize.LEFT;
            _loc3_.addChild(_loc6_);
            _loc4_.height = _loc6_.height + 30;
         }
         return _loc3_;
      }

      public function debugLock() : void
      {
         var _loc1_:Array = this.mainData.userCrop;
         var _loc2_:int = 0;
         while(_loc2_ < _loc1_.length)
         {
            trace("id:" + _loc1_[_loc2_]["cId"] + " lock:" + _loc1_[_loc2_]["lock"] + "");
            _loc2_++;
         }
      }

      public function welcomeEnd() : void
      {
         this.taskComp("help");
      }

      public function unLockCrop(param1:String, param2:String) : void
      {
         var _loc3_:String = null;
         trace("解锁操作" + param1);
         if(param2 == "11")
         {
            _loc3_ = param1 + ":2";
            this.fr.postRequest2("" + this.version + "cgi_farm_set_lock",{
               "crop":_loc3_,
               "type":param2,
               "cId":param1
            },this.unLockCropFn);
         }
         else
         {
            this.fr.postRequest2("cgi_get_repertory",{
               "target":"unlock",
               "cId":param1
            },this.unLockCropFn);
         }
      }

      public function activeHunter(param1:int) : void
      {
         var _loc2_:Object = {
            "itemId":param1,
            "action":"active"
         };
         this.fr.postRequest("cgi_active_guard",_loc2_,this.activeHunterFn);
      }

      public function validateCode(param1:String) : void
      {
         var _loc2_:Object = LocalData.lastRequestValue;
         if(_loc2_)
         {
            _loc2_["validatemsg"] = param1;
         }
         else
         {
            _loc2_ = {"validatemsg":param1};
         }
         LocalData.lastRequestFn(LocalData.lastRequestUrl,LocalData.lastRequestValue,LocalData.lastRequestHandle);
      }

      public function getHistoryInfo(param1:Function, param2:String) : void
      {
         this.historyCallBackFn = param1;
         this.fr.postRequest2("cgi_get_rep_history",{"uId":param2},this.getHistoryFn);
      }

      public function getUserCub() : void
      {
         if(this.farmData.reloadUserSeed)
         {
            this.requestStartTime = getTimer();
            this.mainData.userCropLoading = true;
            this.fr.postRequest2("cgi_get_package",null,this.getUserCubFn);
         }
         else
         {
            this.getUserCubFn(this.farmData.userSeed);
         }
      }

      public function taskComp(param1:String) : Boolean
      {
         var _loc2_:int = 0;
         if(TaskData.getInstance().currentTask["taskFlag"] == 1 || TaskData.getInstance().currentTask["taskId"] == 0)
         {
            _loc2_ = int(TaskData.getInstance().currentTask["taskId"]);
            var _loc3_:Object = this.taskList[String(_loc2_)];
            if(Boolean(_loc3_) && _loc3_["name"] == param1)
            {
               this.updateTask();
               return true;
            }
            return false;
         }
         return false;
      }

      public function getSeedInfo() : void
      {
         if(this.mainData.seedInfo != null && this.cacheSeedsData != null)
         {
            this.mainData.seedInfo = this.cacheSeedsData as Array;
            return;
         }
         this.mainData.shopSeedLoading = true;
         this.requestStartTime = getTimer();
         this.fr.postRequest2("cgi_get_animals",null,this.getSeedInfoFn);
      }

      public function verifyCFTRequest(param1:int, param2:String, param3:int, param4:int, param5:int = 358) : void
      {
         var _loc6_:String = "";
         _loc6_ = INI.getInstance().data.postUrl.@verifyRequest;
         this._postValue = null;
         this._postValue = {
            "tId":param1,
            "thingName":param2,
            "type":param3,
            "number":param4,
            "appid":param5
         };
         var _loc7_:Object = {};
         if(param5 != 353)
         {
            _loc7_["payitem"] = param3 * 10000 + param1 + "-" + param4 + "-" + param2;
            this.fr.postRequest(_loc6_,_loc7_,this.diyBuyVerifyFn);
         }
         else
         {
            _loc7_["shopType"] = 10;
            _loc7_["itemType"] = param3;
            _loc7_["itemId"] = param1;
            _loc7_["itemNum"] = param4;
            this.fr.postRequest("cgi_farm_shop_verify",_loc7_,this.diyBuyVerifyFn);
         }
      }

      private function updateCache(param1:Object) : void
      {
         if(param1)
         {
            this.localData.setObject("mc_status_" + Version.value + this.mainData.host["uId"],param1,0,false);
         }
      }

      private function upDateStatus(param1:Number) : void
      {
         if(this.mainData.friendStatusRelate[param1])
         {
            Friend(this.mainData.friendStatusRelate[param1]).setStatus();
         }
      }

      private function buyCFTConfirm() : void
      {
         this.cftRequest = INI.getInstance().data.postUrl.@cftRequest;
         this.fr.postRequest(this.cftRequest,this.cftPostValue,this.cftBuyDiyFn);
      }

      public function buyDiy(param1:int, param2:String, param3:String, param4:Boolean = false, param5:int = 0, param6:String = "", param7:int = 0, param8:Boolean = false) : void
      {
         var _loc9_:Object = {
            "itemId":param1,
            "skinBool":param2,
            "msgBool":param3,
            "yellow":0
         };
         if(param4)
         {
            _loc9_["useFB"] = true;
         }
         if(param8)
         {
            _loc9_["yellow"] = 1;
            this.fr.postRequest("cgi_buy_item",_loc9_,this.buyDiyFn);
            return;
         }
         if(!param4)
         {
            this.fr.postRequest("cgi_buy_item",_loc9_,this.buyDiyFn);
         }
      }

      private function infoWindow(param1:String) : void
      {
         var _loc2_:WindowEvent = null;
         if(StringUtil.trim(param1) != "")
         {
            WindowClassLib.register("InfoWindow",InfoWindow);
            _loc2_ = new WindowEvent(WindowEvent.OPEN);
            _loc2_.windowName = "InfoWindow";
            _loc2_.windowArgument = {"text":param1};
            ViewControl.getInstance().dispatchEvent(_loc2_);
         }
      }

      private function loadWildShell() : void
      {
         var _loc1_:Loader = new Loader();
         _loc1_.contentLoaderInfo.addEventListener(Event.COMPLETE,this.onWildComplete);
         var _loc2_:String = GetCropID.addPrefix(INI.getInstance().data.wild[0].@loader);
         _loc1_.load(new URLRequest(_loc2_));
      }

      private function saleAllFn(param1:Object) : void
      {
         var _loc3_:String = null;
         if(this.checkErrorReturn(param1))
         {
            return;
         }
         this.mainData.reloadUserCrop = true;
         this.addMoney(param1);
         this.getUserCrop();
         var _loc2_:Boolean = Command.getInstance().mainCommand.taskComp("maichu");
         if(_loc2_)
         {
            return;
         }
         if(param1.hasOwnProperty("direction") && StringUtil.trim(param1["direction"]) != "")
         {
            this.floatWindow(param1["direction"]);
         }
         else
         {
            this.floatWindow("操作成功！");
         }
      }

      private function getFloatTipActivity(param1:String) : Sprite
      {
         var _loc2_:Sprite = null;
         var _loc3_:MovieClip = null;
         var _loc4_:Boolean = false;
         var _loc5_:TextField = null;
         var _loc6_:TextFormat = null;
         if(!this.lastTip)
         {
            _loc2_ = new Sprite();
            _loc2_.mouseChildren = false;
            _loc2_.mouseEnabled = false;
            _loc3_ = MaterialLib.getInstance().getMaterial("FloatingWindowBg") as MovieClip;
            _loc2_.addChild(_loc3_);
            _loc4_ = false;
            if(param1.indexOf("<br") != -1)
            {
               _loc4_ = true;
            }
            _loc6_ = new TextFormat(null,14,8999699,null,null,null,null,null,TextFormatAlign.LEFT);
            _loc6_.leading = _loc4_ ? 3 : 8;
            _loc5_ = new TextField();
            _loc5_.selectable = false;
            _loc5_.defaultTextFormat = _loc6_;
            _loc5_.width = 220;
            _loc5_.x = 60;
            _loc5_.y = _loc4_ ? 3 : 13;
            _loc5_.wordWrap = true;
            _loc5_.multiline = true;
            _loc5_.htmlText = param1;
            _loc5_.autoSize = TextFieldAutoSize.LEFT;
            _loc2_.addChild(_loc5_);
            _loc3_.height = _loc5_.height + 15;
            _loc3_.width = _loc5_.width + 20;
         }
         return _loc2_;
      }

      private function timerHandler(param1:TimerEvent) : void
      {
         var _loc4_:Object = null;
         var _loc5_:int = 0;
         var _loc2_:Array = this.mainData.animalData;
         if(_loc2_ == null)
         {
            return;
         }
         if(this.farmlandTimer.currentCount % 35 == 0 && MData.getInstance().toolData.mpData == null)
         {
            ViewControl.getInstance().dispatchEvent(new Event(MPScene.MAO_PAO));
         }
         var _loc3_:int = 0;
         while(_loc3_ < _loc2_.length)
         {
            _loc4_ = _loc2_[_loc3_];
            if(_loc4_ != null && !_loc4_.hungry && _loc4_.status != FarmData.ANIMAL_SHOUHUO)
            {
               --_loc4_.growTimeNext;
               ++_loc4_.growTime;
               if(_loc4_.growTimeNext <= 0)
               {
                  if(_loc4_.status == FarmData.ANIMAL_SHENGCHAN)
                  {
                     _loc5_ = GetCropID.getChidNum(_loc4_.cId);
                     MData.getInstance().productData.addProduct(_loc4_.cId,_loc5_,false,true);
                  }
                  _loc4_.status = _loc4_.statusNext;
                  GetCropID.setNext(_loc4_);
                  this.mainData.nextStatusAnimal = _loc4_;
                  return;
               }
            }
            _loc3_++;
         }
      }

      public function sale(param1:int, param2:int, param3:Function = null) : void
      {
         var _loc4_:Object = {
            "cId":param1,
            "num":param2
         };
         if(param3 != null)
         {
            this.fr.postRequest("cgi_sale_product",_loc4_,param3);
         }
         else
         {
            this.fr.postRequest("cgi_sale_product",_loc4_,this.saleFn);
         }
      }

      private function addGameMoney(param1:GameEvent) : void
      {
         var _loc2_:Object = {};
         _loc2_["money"] = param1.addMoney;
         this.addMoney(_loc2_);
         this.mainData.reloadUserCrop = true;
         this.farmData.reloadUserSeed = true;
      }

      public function getFriendList(param1:Boolean = false, param2:Boolean = false) : void
      {
         this.mainData.getFriendListLoading = true;
         if(param1)
         {
            this.fr.postRequest(INI.getInstance().getPostUrl() + "friend",{"user":param1},this.getFriendListAndSeverFn);
            return;
         }
         if(this.mainData.friendList != null)
         {
            this.doFriendListFn(this.mainData.friendList);
            if(param2)
            {
               this.getFriendStatus();
            }
            return;
         }
         var _loc3_:Array = this.localData.getObject("mc" + Version.value + this.mainData.host["uId"],CommonData.serverTime) as Array;
         if(_loc3_ != null && _loc3_.length > 0)
         {
            this.doFriendListFn(_loc3_);
            if(param2)
            {
               this.getFriendStatus();
            }
            return;
         }
         this.fr.postRequest(INI.getInstance().getPostUrl() + "friend",{"user":param1},this.getFriendListAndSeverFn);
      }

      public function diyRenew(param1:int) : void
      {
         var _loc2_:Object = {"id":param1};
         this.fr.postRequest("mod=item&act=renew",_loc2_,this.diyRenewFn);
      }

      public function lockCrop(param1:String, param2:String) : void
      {
         var _loc3_:String = null;
         trace("加操作" + param1);
         if(param2 == "11")
         {
            _loc3_ = param1 + ":1";
            this.fr.postRequest2("" + this.version + "cgi_farm_set_lock",{
               "crop":_loc3_,
               "type":param2,
               "cId":param1
            },this.lockCropFn);
         }
         else
         {
            this.fr.postRequest2("cgi_get_repertory",{
               "target":"lock",
               "cId":param1
            },this.lockCropFn);
         }
      }

      private function addPackAnimalFn(param1:Object) : void
      {
         var _loc2_:Number = NaN;
         var _loc3_:Number = NaN;
         var _loc4_:int = 0;
         var _loc5_:String = null;
         var _loc6_:Object = null;
         if(this.checkErrorReturn(param1))
         {
            return;
         }
         if(param1["ecode"] == 0)
         {
            _loc2_ = 0;
            _loc3_ = 0;
            _loc4_ = 0;
            while(_loc4_ < param1.animal.length)
            {
               if(GetCropID.getHouse(param1.animal[_loc4_]["cId"]) == "窝")
               {
                  _loc2_++;
               }
               else
               {
                  _loc3_++;
               }
               _loc4_++;
            }
            this.mainData.host["animal1"] += _loc2_;
            this.mainData.host["animal2"] += _loc3_;
            ViewControl.getInstance().dispatchEvent(new Event("animal_change"));
            this.addExp(param1);
            MainData.addPackAnimal = true;
            this.mainData.animalAddArray = param1.animal;
            _loc5_ = "添加成功。";
            if(this._expAlertTip == false)
            {
               if(param1["addExp"] != undefined && param1["addExp"] == 0)
               {
                  if(param1["direction"] != undefined && param1["direction"] != "")
                  {
                     _loc5_ += "<br>(" + param1["direction"] + ")";
                     this._expAlertTip = true;
                  }
               }
            }
            this.floatWindow(_loc5_);
            _loc6_ = this.getSeed(param1["post_data"]["type"],"9");
            --_loc6_["amount"];
            if(_loc6_["amount"] <= 0)
            {
               Cursor.setCursor("CursorArrow");
               this.farmData.reloadUserSeed = true;
            }
         }
         else
         {
            this.floatWindow(param1["direction"]);
         }
      }

      private function getAllInfoFn(param1:Object) : void
      {
         var _loc2_:* = undefined;
         var _loc3_:String = null;
         var _loc4_:Object = null;
         if(param1.hasOwnProperty("errorType"))
         {
            _loc3_ = param1["errorType"];
            if(_loc3_ == "IOError" || _loc3_ == "httpStatus" || _loc3_ == "timeOut")
            {
               this.mainData.profileErr = "请求超时，" + "<a href=\'event:reload\'><u><font color=\'#ff6600\'>点击重试</font></u></a>";
               return;
            }
         }
         if(param1["code"] == 0 || Boolean(param1["code"]) && Boolean(param1["code"] != 1))
         {
            this.mainData.profileErr = "请求超时，" + "<a href=\'event:reload\'><u><font color=\'#ff6600\'>点击重试</font></u></a>";
            return;
         }
         if(Boolean(param1["ret"]) && param1["ret"] != 0)
         {
            ViewControl.getInstance().dispatchEvent(new Event("SystemMsgLoadFailed"));
            this.mainData.profileLoading = false;
            return;
         }
         this.mainData.profileLoading = false;
         if(param1["post_data"].profile == 1)
         {
            MainData.loadedProfile = true;
         }
         if(param1["post_data"].msg == 1)
         {
            MainData.loadedMsg = true;
         }
         if(Boolean(param1["post_data"].hasOwnProperty("appid")) && param1["post_data"]["appid"] == "358")
         {
            MainData.loadedSystemMsg = true;
         }
         for(_loc2_ in param1)
         {
            this.profile[_loc2_] = param1[_loc2_];
         }
         this.mainData.profile = this.profile;
         if(this.isFirstLoadSysMsg)
         {
            this.isFirstLoadSysMsg = false;
            _loc4_ = {};
            this.mainData.profileLoading = true;
            _loc4_.uin = MData.getInstance().mainData.host["uin"];
            _loc4_.opuin = MData.getInstance().mainData.host["uin"];
            _loc4_.appid = "358";
            _loc4_.msgnum = "300";
            this.fr.postRequest2("" + Version.value + "sysmsg_select",_loc4_,this.getAllInfoFn);
         }
      }

      public function searchFriend(param1:String = "") : void
      {
         if(param1 != "")
         {
            this.mainData.searchFriendValue = param1;
            if(this.mainData.showFriendPage > this.mainData.showFriendSum)
            {
               this.mainData.showFriendPage = 1;
               this.pageHandler();
               return;
            }
         }
         this.mainData.searchFriendValue = param1;
         this.pageHandler();
      }

      private function levelUpFn(param1:Object) : void
      {
         this.addLevelReward({"levelUp":param1});
      }

      public function alertWindow(param1:String, param2:String, param3:Boolean = false) : void
      {
         var _loc4_:WindowEvent = null;
         if(StringUtil.trim(param2) != "")
         {
            _loc4_ = new WindowEvent(WindowEvent.OPEN);
            _loc4_.windowName = "AlertWindow";
            _loc4_.windowArgument = {
               "type":param1,
               "text":param2,
               "textLinkHandle":param3
            };
            ViewControl.getInstance().dispatchEvent(_loc4_);
         }
      }

      private function qqBuyToolFn(param1:Object) : void
      {
         var _loc2_:Object = {};
         if(param1["code"] == 0)
         {
            _loc2_["code"] = 1;
            _loc2_["direction"] = "购买成功";
            _loc2_["type"] = this.preBuyToolType;
            MData.getInstance().farmData.reloadUserSeed = true;
         }
         else
         {
            _loc2_["code"] = 0;
            _loc2_["direction"] = param1["msg"];
         }
         this.buyToolFn(_loc2_);
      }

      private function doFriendListFn(param1:Object) : void
      {
         var _loc3_:int = 0;
         var _loc4_:Number = NaN;
         if(param1 == null)
         {
            return;
         }
         this.mainData.getFriendListLoading = false;
         var _loc2_:Array = param1 as Array;
         _loc3_ = 0;
         while(_loc3_ < _loc2_.length)
         {
            _loc4_ = Number(_loc2_[_loc3_]["uId"]);
            if(_loc4_ == this.mainData.host["uId"])
            {
               _loc2_[_loc3_]["me"] = true;
               _loc2_[_loc3_]["exp"] = this.mainData.host["exp"];
               _loc2_[_loc3_]["money"] = this.mainData.host["money"];
            }
            else
            {
               _loc2_[_loc3_]["me"] = false;
            }
            _loc3_++;
         }
         _loc2_.sort(this.friendSort);
         _loc3_ = 0;
         while(_loc3_ < _loc2_.length)
         {
            _loc2_[_loc3_]["sort"] = _loc3_ + 1;
            if(_loc2_[_loc3_].hasOwnProperty("userId"))
            {
               _loc2_[_loc3_]["uId"] = _loc2_[_loc3_]["userId"];
               delete _loc2_[_loc3_]["userId"];
            }
            _loc3_++;
         }
         this.mainData.friendList = _loc2_;
         this.pageHandler();
      }

      public function addLevelReward(param1:Object) : void
      {
         if(param1.hasOwnProperty("levelUp") && param1["levelUp"] != null && param1["levelUp"] != false)
         {
            this.mainData.levelReward = param1["levelUp"];
            this.addReward(param1["levelUp"]["item"]);
            if(Boolean(param1["levelUp"].hasOwnProperty("vipItem")) && param1["levelUp"]["vipItem"] != false)
            {
               this.addReward(param1["levelUp"]["vipItem"]);
            }
         }
      }

      public function getToolsInfo() : void
      {
         if(this.mainData.toolsInfo != null)
         {
            return;
         }
         this.mainData.shopToolLoading = true;
         this.fr.postRequest2("cgi_get_food",null,this.getToolsInfoFn);
      }

      public function getCropsMaterial(param1:Object, param2:Function, param3:Function) : void
      {
         var _loc7_:Object = null;
         var _loc8_:String = null;
         var _loc9_:String = null;
         var _loc10_:String = null;
         var _loc11_:String = null;
         var _loc12_:String = null;
         var _loc4_:Array = param1["animal"];
         var _loc5_:Array = [];
         var _loc6_:Object = {};
         for each(_loc7_ in _loc4_)
         {
            if(_loc7_.hasOwnProperty("cId"))
            {
               _loc9_ = _loc7_["cId"];
               if(_loc9_)
               {
                  _loc10_ = "Animal_" + _loc9_ + "_1";
                  if(MaterialLib.getInstance().getClass(_loc10_) == null)
                  {
                     _loc11_ = GetCropID.getSwfUrl() + "main/animal/";
                     _loc12_ = GetCropID.getAnimalV(_loc9_);
                     if(_loc12_ != "")
                     {
                        _loc6_[_loc9_] = _loc11_ + "a" + _loc9_ + ".swf" + "?v=" + _loc12_;
                     }
                     else
                     {
                        _loc6_[_loc9_] = _loc11_ + "a" + _loc9_ + ".swf";
                     }
                  }
               }
            }
         }
         for each(_loc8_ in _loc6_)
         {
            _loc5_.push(_loc8_);
         }
         if(_loc5_.length > 0)
         {
            if(this.cropsLoader)
            {
               this.cropsLoader.removeEventListener(CropLoader.ITEM_COMPLETE,param3);
               this.cropsLoader = null;
            }
            this.cropsLoader = new CropLoader();
            this.cropsLoader.addEventListener(CropLoader.ITEM_COMPLETE,param3);
            this.cropsLoader.load(_loc5_,true);
         }
         else
         {
            param2();
         }
      }

      private function onFloatWindowComplete(param1:Sprite) : void
      {
         if(param1)
         {
            PopUpManager.removePopUp(param1);
         }
         this.lastTip = null;
      }

      private function getVipReturnPackageFn(param1:Object) : void
      {
         if(!(param1.hasOwnProperty("code") && param1["code"] == 1))
         {
            return;
         }
         MainData.vipReturnGift = true;
         this.mainData.VipReturnPackage = param1;
      }

      public function getUserCrop() : void
      {
         if(this.mainData.reloadUserCrop)
         {
            this.requestStartTime = getTimer();
            this.mainData.userCropLoading = true;
            this.fr.postRequest2("cgi_get_repertory?target=animal",null,this.getUserCropFn);
         }
         else
         {
            this.getUserCropFn(this.mainData.userCrop);
         }
      }

      public function getMarkListFromJs(param1:Function, param2:String = "0") : void
      {
      }

      private function setHunter(param1:Object) : void
      {
         if(param1)
         {
            this.mainData.hunter = {
               "id":param1["id"],
               "name":param1["name"],
               "t":param1["striketime"],
               "used":1
            };
         }
         else
         {
            this.mainData.hunter = {
               "id":1,
               "name":"",
               "t":0,
               "used":0
            };
         }
      }

      private function lockCropFn(param1:Object) : void
      {
         var _loc2_:Boolean = false;
         var _loc3_:Array = null;
         var _loc4_:int = 0;
         trace("lock");
         this.debugLock();
         if(this.checkErrorReturn(param1))
         {
            return;
         }
         if(param1["code"])
         {
            if(Boolean(param1["post_data"].hasOwnProperty("type")) && param1["post_data"]["type"] == "11")
            {
               _loc2_ = true;
            }
            else
            {
               _loc2_ = false;
            }
            if(_loc2_)
            {
               _loc3_ = this.mainData.userMaterial;
            }
            else
            {
               _loc3_ = this.mainData.userCrop;
            }
            _loc4_ = 0;
            while(_loc4_ < _loc3_.length)
            {
               if(_loc3_[_loc4_]["cId"] == param1["post_data"]["cId"])
               {
                  if(_loc2_)
                  {
                     _loc3_[_loc4_]["isLock"] = 1;
                  }
                  else
                  {
                     _loc3_[_loc4_]["lock"] = 1;
                  }
                  if(_loc2_)
                  {
                     this.mainData.userMaterial = _loc3_;
                  }
                  else
                  {
                     this.mainData.userCrop = _loc3_;
                  }
                  break;
               }
               _loc4_++;
            }
            this.mainData.lockCropData = {
               "lock":1,
               "cId":param1["post_data"]["cId"],
               "type":param1["type"]
            };
         }
         this.debugLock();
      }

      public function setItems(param1:Object) : void
      {
         this.mainData.items = param1;
         if(this.mainData.me)
         {
            this.mainData.host["house1"] = 0;
            this.mainData.host["house2"] = 0;
            if(param1.hasOwnProperty("2"))
            {
               this.mainData.host["house1"] = String(param1["2"]["lv"]);
            }
            if(param1.hasOwnProperty("3"))
            {
               this.mainData.host["house2"] = String(param1["3"]["lv"]);
            }
         }
         ViewControl.getInstance().dispatchEvent(new Event("animal_change"));
         this.mainData.userMCBg = param1["1"]["id"];
         this.mainData.grassSkin = param1["1"]["skin"];
         this.mainData.grassMp = param1["1"]["msg"];
         this.updateGrassCutter();
         if(this.mainData.grassMp == "1")
         {
            if(GetCropID.mpXmlIsNull() && GetCropID._loading == false)
            {
               GetCropID.getMPXMl();
            }
         }
      }

      private function enforceMillFn(param1:Object) : void
      {
         if(param1 != null && param1["ret"] != undefined)
         {
            this.mainData.millOpened = parseInt(param1["ret"]) == 100 ? true : false;
         }
         this.mainData.dispatchEvent(new Event("refreshMillIcon"));
      }

      public function getUserMaterial() : void
      {
         if(this.mainData.reloadUserMaterial)
         {
            this.requestStartTime = getTimer();
            this.mainData.userMaterialLoading = true;
            this.fr.postRequest2("" + this.version + "cgi_farm_getusercrop",null,this.getUserMaterialFn);
         }
         else if(WildData.reloadCrystal)
         {
            this.fr.postRequest2(GetCropID.getCommonUrlNc() + "cgi_farm_get_usercrystal",{"type":9},this.crystalFn);
         }
         else
         {
            this.getUserMaterialFn(this._tempMaterial);
         }
      }

      public function run() : void
      {
         var _loc1_:Array = null;
         this.requestStartTime = getTimer();
         if(LocalData.parameters)
         {
            _loc1_ = LocalData.parameters["loadedInfo"];
            _loc1_["newitem"] = 2;
         }
         if(LocalData.mode == "qzone")
         {
            this.fr.postRequest2("cgi_enter",_loc1_,this.runFn);
         }
         else
         {
            this.fr.postRequest2("cgi_enter",_loc1_,this.runFn);
         }
      }

      public function getVipReturnGifts() : void
      {
         var _loc1_:Object = new Object();
         _loc1_["opt"] = 0;
         _loc1_["isfarm"] = 0;
         this.fr.postRequest("cgi_return_gift",_loc1_,this.getVipReturnPackageFn);
      }

      private function updateHeadList() : void
      {
         var _loc1_:Array = null;
         var _loc2_:int = 0;
         var _loc3_:Array = null;
         var _loc4_:int = 0;
         if(Version.value == "qzone")
         {
            _loc1_ = this.mainData.showFriendList;
            _loc2_ = int(this.mainData.showFriendList.length);
            _loc3_ = [];
            _loc4_ = 0;
            while(_loc4_ < _loc2_)
            {
               _loc3_.push(_loc1_[_loc4_]["uin"]);
               _loc4_++;
            }
            JSProxy.getHeadList(_loc3_,25,this.setHeadList);
            this.getMarkListFromJs(this.setMarkList);
         }
      }

      private function getCropStatusAllFn(param1:Object) : void
      {
         var _loc2_:String = null;
         var _loc3_:Object = null;
         if(param1.hasOwnProperty("errorType"))
         {
            _loc2_ = param1["errorType"];
            if(_loc2_ == "IOError" || _loc2_ == "httpStatus" || _loc2_ == "timeOut")
            {
               this.alertWindow("error","请求超时，稍后再试");
            }
            if(_loc2_ == "system")
            {
               this.alertWindow("error",param1["errorContent"]);
            }
            this.mainData.userChanging = false;
            EventRecorder.recordErrorEvent(EventRecorder.MC_ENTER,getTimer() - this.requestStartTime,EventRecorder.FAULT_ERROR);
            RequestManager.getInstance().addUin(param1["post_data"]["uId"]);
            return;
         }
         EventRecorder.recordSueecssEvent(EventRecorder.MC_ENTER,getTimer() - this.requestStartTime);
         LocalData.playingAnimation = false;
         this.mainData.userChanging = false;
         this.setServerTime(param1["serverTime"]);
         this.checkParade(param1);
         RequestManager.getInstance().resetUin(param1["post_data"]["uId"]);
         if(this.setUserData != null)
         {
            _loc3_ = this.mainData.currentUser;
            _loc3_["exp"] = param1["user"]["exp"];
            _loc3_["headPic"] = this.setUserData["headPic"];
            _loc3_["uId"] = this.setUserData["uId"];
            _loc3_["uin"] = this.setUserData["uin"];
            _loc3_["userName"] = this.setUserData["userName"];
            _loc3_["yellowlevel"] = this.setUserData["yellowlevel"];
            _loc3_["yellowstatus"] = this.setUserData["yellowstatus"];
            _loc3_["money"] = this.setUserData["money"];
            _loc3_["moralexp"] = param1["user"]["moralexp"];
            if(_loc3_["uId"] == this.mainData.host.uId)
            {
               _loc3_["me"] = true;
               if(param1["user"]["money"])
               {
                  this.mainData.host["money"] = param1["user"]["money"];
               }
               if(param1["user"]["exp"])
               {
                  this.mainData.host["exp"] = param1["user"]["exp"];
               }
               this.mainData.host = LipiUtil.clone(this.mainData.host);
            }
            else
            {
               _loc3_["me"] = false;
            }
            this.mainData.currentUser = _loc3_;
            GameProxy.getInstance().currentUser = _loc3_;
         }
         this.mainData.userFarmData = param1;
         this.unread(param1["a"],param1["b"],param1["c"],param1["d"]);
         this.setUserFarm(param1);
         this.checkAndReportSteal(param1["stealflag"]);
      }

      private function diyBuyVerifyFn(param1:Object) : void
      {
         var _loc2_:Object = {};
         if(param1.hasOwnProperty("code"))
         {
            _loc2_["code"] = 1;
            _loc2_["postValue"] = this._postValue;
            if(param1.hasOwnProperty("open") && param1["open"] == "1")
            {
               _loc2_["open"] = param1["open"];
            }
         }
         else if(param1.hasOwnProperty("errorType"))
         {
            _loc2_["code"] = 0;
            _loc2_["errorType"] = param1["errorType"];
            _loc2_["direction"] = param1["errorContent"];
         }
         this.returnFn(_loc2_);
      }

      public function sortBy(param1:String) : void
      {
         this.mainData.sortField = param1;
         this.doFriendListFn(this.mainData.friendList);
      }

      public function getCropStatus(param1:String = "0", param2:Boolean = true) : void
      {
         var is403:String = null;
         var ownerId:String = param1;
         var useloading:Boolean = param2;
         if(ownerId != "0" && ownerId != this.mainData.host["uId"])
         {
            try
            {
               is403 = FeartureManager.enterMod();
               if(is403)
               {
                  setTimeout(this.alertWindow,120,"tip",is403);
                  return;
               }
            }
            catch(e:Error)
            {
            }
         }
         if(MainCommand.requestUID != ownerId)
         {
            RequestManager.getInstance().resetAction(RequestManager.ENTER);
            MainCommand.requestUID = ownerId;
         }
         this.requestStartTime = getTimer();
         if(useloading)
         {
            this.mainData.userChanging = true;
         }
         this.fr.postRequest2("cgi_enter?",{
            "uId":ownerId,
            "flag":1,
            "newitem":2
         },this.getCropStatusAllFn,RequestManager.ENTER);
         Command.getInstance().farmCommand.isShouhuo = false;
      }

      private function getToolsInfoFn(param1:Object) : void
      {
         var _loc3_:String = null;
         if(param1.hasOwnProperty("errorType"))
         {
            _loc3_ = param1["errorType"];
            if(_loc3_ == "IOError" || _loc3_ == "httpStatus" || _loc3_ == "timeOut")
            {
               this.mainData.shopToolErr = "请求超时，" + "<a href=\'event:reload\'><u><font color=\'#ff6600\'>点击重试</font></u></a>";
               return;
            }
         }
         this.mainData.shopToolLoading = false;
         var _loc2_:Array = new Array();
         this.mainData.toolsInfo = _loc2_.concat(param1);
      }

      public function saleMaterial(param1:int, param2:int) : void
      {
         var _loc3_:Object = {
            "cId":param1,
            "number":param2
         };
         this.fr.postRequest("" + this.version + "repertory&act=sale",_loc3_,this.saleFn);
      }

      private function crystalFn(param1:Object) : void
      {
         var _loc2_:Array = null;
         if(param1["ecode"] == 0)
         {
            this.mainData.reloadUserMaterial = false;
            this.mainData.userMaterialLoading = false;
            WildData.reloadCrystal = false;
            this._tempCrystal = param1["info"];
            this.mainData.UserCrystal = param1["info"];
            _loc2_ = [];
            _loc2_ = this._tempMaterial.concat(this._tempCrystal);
            this.mainData.userMaterial = _loc2_;
         }
         else
         {
            this.mainData.userMaterialErr = "请求超时，" + "<a href=\'event:reload\'><u><font color=\'#ff6600\'>点击重试</font></u></a>";
         }
      }

      public function addMoney(param1:Object) : void
      {
         if(param1.hasOwnProperty("money") && param1["money"] != 0)
         {
            this.mainData.host["money"] = int(this.mainData.host["money"]) + int(param1["money"]);
            this.mainData.addMoney = param1["money"];
         }
      }

      public function getCdKey(param1:Object) : void
      {
         this.fr.postRequest("mod=market&act=change",param1,this.getCdKeyFn);
      }

      private function onWildComplete(param1:Event) : void
      {
         MaterialLib.getInstance().push(LoaderInfo(param1.target).applicationDomain);
         var _loc2_:Class = MaterialLib.getInstance().getClass("wild.com.Shell.WildShell");
         this._wildShell = new _loc2_();
         this._wildShell.initConfig(this._beastapi);
      }

      public function register() : void
      {
         if(LocalData.mode == "qzone")
         {
            this.fr.postRequest("cgi_register",null,this.openVipToMcFn);
         }
         else
         {
            this.fr.postRequest("cgi_register",null,this.openVipToMcFn);
         }
      }

      public function getFriendStatus() : void
      {
         var _loc3_:String = null;
         this.mainData.getFriendListLoading = true;
         var _loc1_:String = "";
         var _loc2_:Object = this._friends || this.localData.getObject("mc" + Version.value + this.mainData.host["uId"],CommonData.serverTime) as Array;
         if(!_loc2_)
         {
            this.mainData.getFriendListLoading = false;
            return;
         }
         for(_loc3_ in _loc2_)
         {
            _loc1_ += (_loc2_[_loc3_]["userId"] || _loc2_[_loc3_]["uId"]) + "|";
         }
         this.requestStartTime = getTimer();
         this.fr.postRequest2("cgi_get_Exp",{
            "uidlist":_loc1_,
            "optflag":1,
            "expflag":0
         },this.getExpFn);
      }

      private function onMoneyBack(param1:Object) : void
      {
         ViewControl.getInstance().dispatchEvent(new Event("get_money_ok"));
         if(this.checkErrorReturn(param1))
         {
            return;
         }
         this.alertWindow("success",param1["direction"]);
         this.farmData.reloadUserSeed = true;
         this.addMoney(param1);
      }

      public function getPackageEnd() : void
      {
         this.fr.postRequest("cgi_accept_gift",null,this.getPackageEndFn);
      }

      private function setServerTime(param1:Object) : void
      {
         if(Boolean(param1) && Boolean(param1["time"]))
         {
            CommonData.serverTime = param1["time"];
         }
      }

      private function runFn(param1:Object) : void
      {
         var _loc2_:String = null;
         var _loc3_:ResearchModel = null;
         var _loc4_:URLRequest = null;
         if(LocalData.loginFlag == false)
         {
            this.mainData.runError = LocalData.loginTxt;
            return;
         }
         if(param1.hasOwnProperty("errorType"))
         {
            if(param1["errorCode"] == "-10001")
            {
               this.mainData.runError = "尊敬的用户：您还没有注册QQ牧场，<a href=\'event:noreg\'><u><font color=\'#ff6600\'>点这里注册。</font></u></a>";
               return;
            }
            if(param1["errorType"] == "session")
            {
               _loc2_ = INI.getInstance().data.version.@loginurl;
               this.mainData.runError = "登录超时，请重新登录。";
               EventRecorder.recordErrorEvent(EventRecorder.MC_ENTER,getTimer() - this.requestStartTime,EventRecorder.FAULT_SESSION);
            }
            else
            {
               EventRecorder.recordErrorEvent(EventRecorder.MC_ENTER,getTimer() - this.requestStartTime,EventRecorder.FAULT_ERROR);
               this.mainData.runError = "尊敬的用户：由于您当前网络不稳定，导致QQ牧场无法进入，请稍后重试。";
            }
         }
         else
         {
            LocalData.parameters["speedInfo"][2] = getTimer();
            trace("server return time :" + getTimer());
            if(int(Math.random() * 30) == 0)
            {
               _loc4_ = new URLRequest("nmc.php?");
               _loc4_.data = LocalData.parameters["speedInfo"];
               sendToURL(_loc4_);
            }
            trace("render over time2:" + getTimer());
            Security.loadPolicyFile("http://qzonestyle.gtimg.cn/crossdomain.xml");
            Security.loadPolicyFile("");
            EventRecorder.recordSueecssEvent(EventRecorder.MC_ENTER,getTimer() - this.requestStartTime);
            _loc3_ = ResearchModel.gi();
            _loc3_.UpdataW = param1["research"]["den"];
            _loc3_.UpdataP = param1["research"]["shed"];
            _loc3_.DenShedLevel = {
               "den":param1["items"]["2"]["lv"],
               "shed":param1["items"]["3"]["lv"]
            };
            _loc3_.bgLv = param1["items"]["1"];
            this.mainData.runComp = true;
            param1["user"].pf = 1;
            this.setServerTime(param1["serverTime"]);
            this.setHostUser(param1["user"]);
            this.setWeather(param1["weather"]);
            this.setTask(param1["task"]);
            this.mainData.houseChangeData = param1["wp"];
            if(Boolean(param1["wp"]) && Boolean(param1["wp"]["content"]))
            {
               this.infoWindow(param1["wp"]["content"]);
            }
            MainData.gift = param1["d"];
            MainData.isNewUser = param1["d"];
            if(LocalData.useExpressUser)
            {
               this.setUser(LocalData.expressUser);
               LocalData.useExpressUser = false;
            }
            else
            {
               this.mainData.userFarmData = param1;
               this.setUserFarm(param1);
            }
            _loc3_.openFirstBox();
            ModuleManager.checkSubModule();
         }
      }

      public function buyToolFn(param1:Object) : void
      {
         var _loc2_:String = null;
         if(param1["code"] == 0)
         {
            MData.getInstance().farmData.reloadUserSeed = true;
            param1.money = -param1.money;
            this.addMoney(param1);
            if(param1.hasOwnProperty("direction") && StringUtil.trim(param1["direction"]) != "")
            {
               this.alertWindow("error",param1["direction"]);
            }
            else
            {
               this.alertWindow("success","购买成功");
            }
         }
         else if(param1.hasOwnProperty("direction") && StringUtil.trim(param1["direction"]) != "")
         {
            this.alertWindow("error",param1["direction"]);
         }
         if(param1.hasOwnProperty("errorType"))
         {
            _loc2_ = param1["errorType"];
            if(_loc2_ == "IOError" || _loc2_ == "httpStatus" || _loc2_ == "timeOut")
            {
               this.alertWindow("error","请求超时，稍后再试");
            }
         }
      }

      private function onInGameBuySuccess(param1:Object) : void
      {
         var _loc2_:Object = null;
         var _loc3_:ResearchModel = null;
         var _loc4_:Object = null;
         var _loc5_:ResearchEvent = null;
         this.mainData.reloadUserItems = true;
         this.farmData.reloadUserSeed = true;
         if(MainData.inGameBuyType == "DIY")
         {
            this.addExp({"addExp":MainData.inGameBuyObject["exp"]});
            _loc2_ = this.mainData.items;
            _loc2_["1"]["id"] = MainData.inGameBuyObject["itemID"];
            this.mainData.items = _loc2_;
            this.mainData.reloadUserItems = true;
            EventRecorder.recordSueecssEvent(EventRecorder.SUCCESS_BUYZS,getTimer() - this.buyTime,null,10);
         }
         else if(MainData.inGameBuyType == "Item")
         {
            MData.getInstance().farmData.reloadUserSeed = true;
            if(MainData.inGameBuyObject["itemType"] == 5)
            {
               Command.getInstance().mainCommand.getCropStatus("0",false);
            }
            EventRecorder.recordSueecssEvent(EventRecorder.SUCCESS_BUYDJ,getTimer() - this.buyTime,null,10);
         }
         else if(MainData.inGameBuyType == "UpdateDenAndShed")
         {
            _loc3_ = ResearchModel.gi();
            if(_loc3_.DenShedLevel.hasOwnProperty("shed") && _loc3_.DenShedLevel["shed"] != 0)
            {
               if(LocalData.reclaimType == 3)
               {
                  _loc3_.DenShedLevel["den"] += 1;
               }
               else if(LocalData.reclaimType == 4)
               {
                  _loc3_.DenShedLevel["shed"] += 1;
               }
               _loc4_ = {
                  "1":{
                     "id":this.mainData.userMCBg,
                     "lv":_loc3_.bgLv["lv"]
                  },
                  "2":{
                     "id":102,
                     "lv":_loc3_.DenShedLevel["den"]
                  },
                  "3":{
                     "id":103,
                     "lv":_loc3_.DenShedLevel["shed"]
                  },
                  "money":_loc3_.needMoney,
                  "qd":true,
                  "code":1,
                  "ecode":0
               };
            }
            else
            {
               if(LocalData.reclaimType == 3)
               {
                  _loc3_.DenShedLevel["den"] += 1;
               }
               _loc4_ = {
                  "1":{
                     "id":this.mainData.userMCBg,
                     "lv":_loc3_.bgLv["lv"]
                  },
                  "2":{
                     "id":102,
                     "lv":_loc3_.DenShedLevel["den"]
                  },
                  "money":_loc3_.needMoney,
                  "qd":true,
                  "code":1,
                  "ecode":0
               };
            }
            ResearchModel.gi().dispatchEvent(new ResearchEvent(ResearchEvent.MUCH_CATCH_CGI));
            _loc5_ = new ResearchEvent(ResearchEvent.UPDATEDENSHED_SUCESS);
            _loc5_.data = _loc4_;
            ResearchModel.gi().dispatchEvent(_loc5_);
            EventRecorder.recordSueecssEvent(EventRecorder.DENSHED_SUCCESS_BUYBYQD,0,null,10);
         }
         else if(MainData.inGameBuyType == "MonthBegin")
         {
            MData.getInstance().farmData.reloadUserSeed = true;
            if(MainData.inGameBuyObject["itemType"] == 5)
            {
               Command.getInstance().mainCommand.getCropStatus("0",false);
            }
            EventRecorder.recordSueecssEvent(EventRecorder.SUCCESS_BUYDJ,getTimer() - this.buyTime,null,10);
            MonthBeginModel.gi().dispatchEvent(new MonthBeginEvent(MonthBeginEvent.EVENT_BUY_GIFT_SUCCESS));
         }
      }

      private function buyReturnFn(param1:Object) : void
      {
         var _loc2_:Object = null;
         var _loc3_:String = null;
         var _loc4_:Object = null;
         var _loc5_:String = null;
         if(param1.hasOwnProperty("direction"))
         {
            if(StringUtil.trim(param1["direction"]) != "")
            {
               if(param1["code"] == 100)
               {
                  JSProxy.showDNA(param1["dnaurl"],this.forDNA);
               }
               else if(param1["code"] == 50 && param1["subchannel"] == 7001)
               {
                  _loc2_ = CookieUtil.getCookie("skey");
                  _loc3_ = "https://www.tenpay.com/cgi-bin/v1.0/communitylogin.cgi?" + "p_uin=" + this.mainData.currentUser.uin + "&skey=" + _loc2_ + "&u1=https://www.tenpay.com/v2.0/main/game_account.shtml";
                  _loc4_ = {
                     "type":"error",
                     "text":param1["direction"],
                     "gotourl":_loc3_
                  };
                  this.alertLinkWindow(_loc4_);
               }
               else if(param1["code"] == 1)
               {
                  MData.getInstance().mainData.sessionTimeout = param1["direction"];
               }
               else
               {
                  this.alertWindow("error",param1["direction"]);
               }
            }
         }
         if(param1.hasOwnProperty("errorType"))
         {
            _loc5_ = param1["errorType"];
            if(_loc5_ == "IOError" || _loc5_ == "httpStatus" || _loc5_ == "timeOut" || _loc5_ == "PHPError")
            {
               this.alertWindow("error","请求超时，稍后再试");
            }
         }
      }

      private function checkWildDataStatus(param1:Object) : void
      {
         var _loc4_:Array = null;
         var _loc2_:Array = param1["info"];
         var _loc3_:int = 0;
         while(_loc3_ < _loc2_.length)
         {
            _loc4_ = _loc2_[_loc3_]["attack"];
            if(this.animalAttack(_loc4_) == false && _loc2_[_loc3_]["fid"] != this.mainData.hostFid && _loc2_[_loc3_]["status"] != 6)
            {
               return;
            }
            _loc3_++;
         }
         this.updateWildStatus(0);
      }

      public function getPackageEndFn(param1:Object) : void
      {
         if(this.checkErrorReturn(param1))
         {
            return;
         }
         MainData.gift = false;
         this.farmData.reloadUserSeed = true;
         if(param1.hasOwnProperty("guard"))
         {
            this.setHunter(param1["guard"]);
         }
      }

      private function getFriendListAndSeverFn(param1:Object) : void
      {
         var _loc3_:* = undefined;
         var _loc4_:String = null;
         if(param1.hasOwnProperty("errorType"))
         {
            _loc4_ = param1["errorType"];
            if(_loc4_ == "IOError" || _loc4_ == "httpStatus" || _loc4_ == "timeOut" || _loc4_ == "PHPError")
            {
               if(Boolean(this.localData.getObject("mc" + Version.value + this.mainData.host["uId"],1)) || Boolean(this._friends))
               {
                  this.mainData.getFriendListLoading = false;
                  return;
               }
               this.mainData.getFriendListErr = "请求超时，" + "<a href=\'event:reload\'><u><font color=\'#ff6600\'>点击重试</font></u></a>";
               return;
            }
            return;
         }
         this._neddUpdateHead = true;
         if(this.hasMe(param1) == false)
         {
            param1.push(this.mainData.host);
         }
         this._friends = [];
         var _loc2_:String = "";
         for each(_loc3_ in param1)
         {
            if(_loc3_["pastrueExp"] != undefined)
            {
               _loc3_["exp"] = _loc3_["pastrueExp"];
            }
            if(_loc3_["uId"])
            {
               this._friends.push(_loc3_);
               _loc2_ += _loc3_["uId"] + "|";
            }
            else if(_loc3_["userId"])
            {
               this._friends.push(_loc3_);
               _loc2_ += _loc3_["userId"] + "|";
            }
         }
         this.requestStartTime = getTimer();
         this.fr.postRequest2("cgi_get_Exp",{
            "uidlist":_loc2_,
            "optflag":1,
            "expflag":0
         },this.getExpFn);
      }

      public function friendBackPage(param1:String = "") : void
      {
         if(param1 != "")
         {
            this.mainData.searchFriendValue = param1;
            if(this.mainData.showFriendPage - 1 > this.mainData.showFriendSum)
            {
               this.mainData.showFriendPage = 1;
               this.pageHandler();
               return;
            }
         }
         if(this.mainData.showFriendPage - 1 > 0)
         {
            this.mainData.searchFriendValue = param1;
            --this.mainData.showFriendPage;
            this.pageHandler();
         }
      }

      private function clearLogFn(param1:Object) : void
      {
         var _loc2_:Object = null;
         if(param1["code"])
         {
            _loc2_ = this.mainData.profile;
            if(_loc2_ != null)
            {
               _loc2_["log"] = [];
            }
            this.mainData.profile = _loc2_;
         }
      }

      public function friendNextPage(param1:String = "") : void
      {
         this.mainData.searchFriendValue = param1;
         if(this.mainData.showFriendPage + 1 <= this.mainData.showFriendSum)
         {
            this.mainData.showFriendPage += 1;
         }
         else
         {
            this.mainData.showFriendPage = 1;
         }
         this.pageHandler();
      }

      private function getSeed(param1:Number, param2:String) : Object
      {
         var _loc3_:int = 0;
         while(_loc3_ < this.farmData.userSeed.length)
         {
            if(this.farmData.userSeed[_loc3_]["tId"] == param1 && this.farmData.userSeed[_loc3_]["type"] == param2)
            {
               return this.farmData.userSeed[_loc3_];
            }
            _loc3_++;
         }
         return {};
      }

      private function addRewardTool(param1:Object) : void
      {
         var _loc3_:Boolean = false;
         var _loc4_:int = 0;
         var _loc2_:FarmData = MData.getInstance().farmData;
         if(_loc2_.userSeed != null)
         {
            _loc3_ = false;
            _loc4_ = 0;
            while(_loc4_ < _loc2_.userSeed.length)
            {
               if(_loc2_.userSeed["tId"] == param1["eParam"])
               {
                  _loc2_.userSeed[_loc4_]["amount"] += param1["eNum"];
                  _loc3_ = true;
               }
               _loc4_++;
            }
            if(!_loc3_)
            {
               _loc2_.userSeed.push({
                  "amount":param1["eNum"],
                  "tId":param1["eParam"],
                  "tName":"",
                  "type":2
               });
            }
         }
      }

      private function clearChatFn(param1:Object) : void
      {
         var _loc2_:Object = null;
         if(param1["code"] == 1)
         {
            _loc2_ = this.mainData.profile;
            if(_loc2_ != null)
            {
               _loc2_["chat"] = [];
            }
            this.mainData.profile = _loc2_;
         }
      }

      public function getFriendByFid(param1:Number) : Object
      {
         var _loc3_:int = 0;
         var _loc2_:Array = this.mainData.friendList;
         if(_loc2_)
         {
            _loc3_ = 0;
            while(_loc3_ < _loc2_.length)
            {
               if(Version.value == "")
               {
                  if(_loc2_[_loc3_]["uId"] == param1)
                  {
                     return _loc2_[_loc3_];
                  }
               }
               else if(_loc2_[_loc3_]["uin"] == param1)
               {
                  return _loc2_[_loc3_];
               }
               _loc3_++;
            }
         }
         return null;
      }

      public function addPackAnimal(param1:int, param2:int) : void
      {
         var _loc3_:Object = {
            "type":param1,
            "number":param2
         };
         this.fr.postRequest("cgi_raise_cub",_loc3_,this.addPackAnimalFn);
      }

      private function getPackageFn(param1:Object) : void
      {
         if(this.checkErrorReturn(param1))
         {
            return;
         }
         this.mainData.giftPackage = param1;
      }

      private function diyRenewFn(param1:Object) : void
      {
         var _loc2_:String = null;
         if(param1.hasOwnProperty("errorType"))
         {
            _loc2_ = param1["errorType"];
            if(_loc2_ == "IOError" || _loc2_ == "httpStatus" || _loc2_ == "timeOut")
            {
               this.alertWindow("error","请求超时，稍后再试");
               return;
            }
         }
         if(param1["code"] == 1)
         {
            this.mainData.reloadUserItems = true;
            this.getUserItems();
            this.alertWindow("success",param1["direction"]);
            this.addMoney(param1);
            this.addFB(param1);
            this.addExp(param1);
            this.addLevelReward(param1);
         }
         else
         {
            this.alertWindow("error","" + param1["direction"]);
         }
      }

      public function alertLinkWindow(param1:Object) : void
      {
         var _loc2_:WindowEvent = null;
         if(StringUtil.trim(param1["text"]) != "")
         {
            _loc2_ = new WindowEvent(WindowEvent.OPEN);
            _loc2_.windowName = "AlertWindow";
            _loc2_.windowArgument = param1;
            ViewControl.getInstance().dispatchEvent(_loc2_);
         }
      }

      public function getMoney() : void
      {
         this.fr.postRequest2("cgi_compen",null,this.onMoneyBack);
      }

      public function getVipReturnPackageEnd() : void
      {
         var _loc1_:Object = new Object();
         _loc1_["opt"] = 1;
         _loc1_["isfarm"] = 0;
         this.fr.postRequest("cgi_return_gift",_loc1_,this.getPackageEndFn);
      }

      private function setTask(param1:Object) : void
      {
         var _loc2_:String = null;
         if(!param1)
         {
            return;
         }
         if(param1["taskId"] < TaskData.TASK_MAX)
         {
            this._loader = new Loader();
            this._loader.contentLoaderInfo.addEventListener(Event.COMPLETE,this.onComp);
            this._loader.contentLoaderInfo.addEventListener(IOErrorEvent.IO_ERROR,this.onIOError);
            _loc2_ = getModule2Url("task")["url"];
            this._loader.load(new URLRequest(_loc2_));
         }
         this._taskData = param1;
      }

      public function sendChat(param1:String, param2:String, param3:int, param4:String, param5:String = "") : void
      {
         var _loc6_:String = this.mainData.host["userName"];
         var _loc7_:Object = {
            "toId":param1,
            "msg":param4,
            "showId":param2,
            "isReply":param3,
            "tName":param5,
            "fName":_loc6_
         };
         this.fr.postRequest(INI.getInstance().getPostUrl() + "chat&act=sendChat",_loc7_,this.sendChatFn);
      }

      private function getUserCropFn(param1:Object) : void
      {
         var _loc3_:String = null;
         if(param1.hasOwnProperty("errorType"))
         {
            _loc3_ = param1["errorType"];
            if(_loc3_ == "IOError" || _loc3_ == "httpStatus" || _loc3_ == "timeOut")
            {
               this.mainData.userCropErr = "请求超时，" + "<a href=\'event:reload\'><u><font color=\'#ff6600\'>点击重试</font></u></a>";
               EventRecorder.recordErrorEvent(EventRecorder.MC_REPERTORY_ANIMAl,getTimer() - this.requestStartTime,EventRecorder.FAULT_ERROR);
               return;
            }
            if(param1.hasOwnProperty("direction"))
            {
               this.mainData.userCropErr = param1["direction"];
            }
            else
            {
               this.mainData.userCropErr = "系统繁忙，请稍候重试。";
            }
            EventRecorder.recordErrorEvent(EventRecorder.MC_REPERTORY_ANIMAl,getTimer() - this.requestStartTime,EventRecorder.FAULT_ERROR);
            return;
         }
         EventRecorder.recordSueecssEvent(EventRecorder.MC_REPERTORY_ANIMAl,getTimer() - this.requestStartTime);
         this.mainData.reloadUserCrop = false;
         this.mainData.userCropLoading = false;
         var _loc2_:Array = new Array();
         _loc2_ = _loc2_.concat(param1);
         _loc2_ = _loc2_.sort(this.cropSortBylv);
         this.mainData.userCrop = _loc2_;
         dispatchEvent(new Event("userCropLoadOK"));
      }

      public function checkStatus() : void
      {
         var _loc3_:Object = null;
         var _loc5_:String = null;
         var _loc1_:Number = Number(this.mainData.currentUser["uId"]);
         var _loc2_:Object = this.mainData.friendStatus;
         if(Boolean(_loc2_) && Boolean(_loc2_[_loc1_]))
         {
            _loc3_ = _loc2_[_loc1_];
         }
         var _loc4_:ProductData = MData.getInstance().productData;
         for(_loc5_ in _loc4_.products)
         {
            if(_loc4_.products[_loc5_].cando == 3 && _loc4_.products[_loc5_].amount > 0)
            {
               if(_loc3_)
               {
                  _loc3_["tdo"] = 1;
                  this.upDateStatus(_loc1_);
               }
               if(!MainData.autoCursor || this.useshengchanCursor == true)
               {
                  return;
               }
               if(this.mainData.me)
               {
                  if(this.canUseAllCursor)
                  {
                     Cursor.delaySetCursor("Cursor_ShouHuoAll");
                  }
                  else
                  {
                     Cursor.delaySetCursor("Cursor_ShengChan");
                  }
               }
               else if(this.canUseAllCursor)
               {
                  Cursor.delaySetCursor("Cursor_ShouHuoAll");
               }
               else
               {
                  Cursor.delaySetCursor("Cursor_Theft");
               }
               return;
            }
         }
         if(_loc3_)
         {
            _loc3_["tdo"] = 0;
            this.upDateStatus(_loc1_);
         }
         this.mainData = MData.getInstance().mainData;
         var _loc6_:Array = this.mainData.animalData;
         var _loc7_:int = 0;
         while(_loc7_ < _loc6_.length)
         {
            if(Boolean(_loc6_[_loc7_]) && Boolean(_loc6_[_loc7_].status == FarmData.ANIMAL_DAICHAN) && _loc6_[_loc7_].hungry == 0)
            {
               if(_loc3_)
               {
                  _loc3_["gdo"] = 1;
                  this.upDateStatus(_loc1_);
               }
               if(!MainData.autoCursor)
               {
                  return;
               }
               if(this.mainData.me)
               {
                  Cursor.delaySetCursor("Cursor_ShengChan");
               }
               else
               {
                  Cursor.delaySetCursor("Cursor_Theft");
               }
               this.useshengchanCursor = true;
               return;
            }
            this.useshengchanCursor = false;
            if(Boolean(_loc6_[_loc7_]) && Boolean(_loc6_[_loc7_].status == FarmData.ANIMAL_SHOUHUO) && this.mainData.me)
            {
               if(this.mainData.host["yellowstatus"] >= 1 && this.mainData.host["yellowlevel"] >= OpenControl.getOpenYellowLv("harvestall"))
               {
                  Cursor.delaySetCursor("Cursor_ShouHuoAll");
               }
               else
               {
                  Cursor.delaySetCursor("Cursor_ShengChan");
               }
               return;
            }
            _loc7_++;
         }
         if(_loc3_)
         {
            delete _loc3_["gdo"];
            this.upDateStatus(_loc1_);
         }
         var _loc8_:Object = MData.getInstance().farmData.flyData;
         if(_loc8_["num"] > 0)
         {
            if(_loc3_)
            {
               _loc3_["pdo"] = 1;
               this.upDateStatus(_loc1_);
            }
            if(!MainData.autoCursor)
            {
               return;
            }
            Cursor.delaySetCursor("Cursor_Flapper");
            return;
         }
         if(Boolean(_loc3_) && _loc3_["pdo"] == 1)
         {
            delete _loc3_["pdo"];
            this.upDateStatus(_loc1_);
         }
         var _loc9_:Object = MData.getInstance().farmData.bbData;
         if(_loc9_["num"] > 0)
         {
            if(_loc3_)
            {
               _loc3_["bdo"] = 1;
               this.upDateStatus(_loc1_);
            }
            if(!MainData.autoCursor)
            {
               return;
            }
            Cursor.delaySetCursor("Cursor_ClearBB");
            return;
         }
         if(Boolean(_loc3_) && _loc3_["bdo"] == 1)
         {
            delete _loc3_["bdo"];
            this.upDateStatus(_loc1_);
         }
         Cursor.delaySetCursor("CursorArrow");
      }

      private function getDiyInfoFn(param1:Object) : void
      {
         var _loc3_:String = null;
         if(param1.hasOwnProperty("errorType"))
         {
            _loc3_ = param1["errorType"];
            if(_loc3_ == "IOError" || _loc3_ == "httpStatus" || _loc3_ == "timeOut")
            {
               this.mainData.shopDiyErr = "请求超时，" + "<a href=\'event:reload\'><u><font color=\'#ff6600\'>点击重试</font></u></a>";
               return;
            }
         }
         this.mainData.shopDiyLoading = false;
         var _loc2_:Array = new Array();
         this.mainData.diyInfo = _loc2_.concat(param1);
      }

      public function enforceMill() : void
      {
         this.mainData.millOpened = true;
         this.mainData.dispatchEvent(new Event("refreshMillIcon"));
      }

      private function showMillInfo(param1:int) : void
      {
         var _loc2_:String = "<br/><p align=\'center\'>加工坊开通资格正在逐步开放中，敬请期待！</p><br/>";
         var _loc3_:HtmlTextWindow = new HtmlTextWindow(_loc2_.replace(/@level/,param1));
         WControl.open(_loc3_);
      }

      private function setHeadList(param1:Object) : void
      {
         var _loc2_:Array = this.mainData.friendList;
         var _loc3_:int = int(this.mainData.friendList.length);
         var _loc4_:int = 0;
         while(_loc4_ < _loc3_)
         {
            if(param1[_loc2_[_loc4_]["uin"]])
            {
               _loc2_[_loc4_]["headPic"] = param1[_loc2_[_loc4_]["uin"]][0];
            }
            _loc4_++;
         }
         this.mainData.updateHead = param1;
         var _loc5_:Number = CommonData.serverTime + 86400 * 3;
         this.localData.setObject("mc" + Version.value + this.mainData.host["uId"],_loc2_,_loc5_,true);
      }

      public function saleAllMaterial(param1:Array) : void
      {
         var _loc2_:Object = {"cIds":param1.join(",")};
         this.fr.postRequest("" + this.version + "repertory&act=saleAll",_loc2_,this.saleAllMaterialFn);
      }

      private function setUserFarm(param1:Object) : void
      {
         var _loc3_:String = null;
         var _loc4_:Array = null;
         var _loc5_:int = 0;
         if(this.mainData.me)
         {
            this.unread(param1["a"],1,param1["c"],param1["d"]);
            if(getVipReturnGift)
            {
               this.vipReturnCheck();
               getVipReturnGift = false;
            }
         }
         this.setFarmlandData(param1["animal"]);
         if(this.mainData.currentUser["me"])
         {
            this.mainData.host["animalFood"] = param1["animalFood"];
         }
         this.setBadInfo(param1["badinfo"]);
         this.setEenemyInfo(param1["enemy"]);
         MData.getInstance().productData.init(param1);
         var _loc2_:ProductData = MData.getInstance().productData;
         for(_loc3_ in param1["stealflag"])
         {
            _loc2_.addCando(_loc3_,param1["stealflag"][_loc3_]);
         }
         _loc4_ = param1["animal"];
         _loc5_ = 0;
         while(_loc5_ < _loc4_.length)
         {
            MData.getInstance().productData.addProduct(_loc4_[_loc5_].cId,_loc4_[_loc5_].totalCome);
            _loc5_++;
         }
         MainData.autoCursor = true;
         this.useshengchanCursor = false;
         FarmData.sFeedTotalError = null;
         this.setItems(param1["items"]);
         this.farmData.animalFood = param1.animalFood;
         if(this.firstRun)
         {
            this.firstRun = false;
            ViewControl.getInstance().dispatchEvent(new Event("maopao"));
            this.canUseAllCursor = OpenControl.checkTime("harvestall") && this.mainData.host["yellowstatus"] >= 1 && this.mainData.host["yellowlevel"] >= OpenControl.getOpenYellowLv("harvestall");
            this.localData.clearObject("mc_status" + Version.value + this.mainData.host["uId"]);
         }
         this.setParade();
         if(MainData.Stage == "farm")
         {
            this.checkStatus();
         }
         this.setHunter(param1["guard"]);
         if(!this._beastapi)
         {
            this._beastapi = BeastAPI.getInstance();
            this._beastapi.beastConfigUrl = INI.getInstance().data.wild[0].@url;
         }
         this._beastapi.beastBase = param1["beast"];
         this.checkWildDataStatus(param1["beast"]);
         if(!this._wildShell)
         {
            this.loadWildShell();
         }
      }

      public function addFB(param1:Object) : void
      {
         if(param1.hasOwnProperty("FB") && param1["FB"] != 0)
         {
            this.mainData.host["FB"] = int(this.mainData.host["FB"]) + int(param1["FB"]);
            this.mainData.addFB = param1["FB"];
         }
      }

      public function getDiyInfo() : void
      {
         if(this.mainData.diyInfo != null)
         {
            return;
         }
         this.mainData.shopDiyLoading = true;
         this.fr.postRequest2("cgi_get_items",null,this.getDiyInfoFn);
      }

      public function checkErrorReturn(param1:Object) : Boolean
      {
         var _loc2_:String = null;
         if(param1.hasOwnProperty("errorType"))
         {
            _loc2_ = param1["errorType"];
            if(_loc2_ == "validateCode")
            {
               return true;
            }
            if(param1.hasOwnProperty("errorContent") && StringUtil.trim(param1["errorContent"]) != "")
            {
               this.alertWindow("error",param1["errorContent"]);
               return true;
            }
            if(_loc2_ == "IOError" || _loc2_ == "httpStatus" || _loc2_ == "timeOut")
            {
               this.alertWindow("error","请求超时，稍后再试");
               return true;
            }
            return true;
         }
         return false;
      }

      private function getUserItemsFn(param1:Object) : void
      {
         var _loc3_:String = null;
         if(param1.hasOwnProperty("errorType"))
         {
            _loc3_ = param1["errorType"];
            if(_loc3_ == "IOError" || _loc3_ == "httpStatus" || _loc3_ == "timeOut")
            {
               this.mainData.userItemErr = "请求超时，" + "<a href=\'event:reload\'><u><font color=\'#ff6600\'>点击重试</font></u></a>";
               return;
            }
            if(_loc3_ == "session")
            {
               this.alertWindow("error",param1["errorContent"]);
               return;
            }
         }
         this.mainData.reloadUserItems = false;
         this.mainData.userItemLoading = false;
         var _loc2_:Array = new Array();
         _loc2_ = _loc2_.concat(param1);
         this.mainData.userItems = _loc2_;
      }

      public function addReward(param1:Array) : void
      {
         var _loc2_:FarmData = MData.getInstance().farmData;
         if(!param1)
         {
            return;
         }
         var _loc3_:int = 0;
         while(_loc3_ < param1.length)
         {
            switch(int(param1[_loc3_]["eType"]))
            {
               case 7:
                  this.addExp({"exp":param1[_loc3_]["eNum"]});
                  break;
               case 6:
                  this.addMoney({"money":param1[_loc3_]["eNum"]});
                  break;
               case 5:
                  break;
               case 4:
                  break;
               case 3:
                  break;
               case 2:
                  this.mainData.reloadUserItems = true;
                  break;
               case 1:
            }
            _loc3_++;
         }
      }

      public function buyTool(param1:int, param2:int, param3:int, param4:Boolean = false, param5:String = "", param6:int = 0, param7:Boolean = false) : void
      {
         var _loc8_:Object = null;
         var _loc9_:String = null;
         var _loc10_:Object = null;
         if(!param4)
         {
            if(param1 == 1)
            {
               if(param7)
               {
                  Command.getInstance().farmCommand.addFood(param2,1);
               }
               else
               {
                  _loc8_ = {
                     "tId":param1,
                     "foodnum":param2
                  };
                  this.fr.postRequest("cgi_buy_food",_loc8_,this.buyFoodFn);
               }
               return;
            }
            _loc8_ = {
               "tId":param1,
               "number":param2
            };
            this.fr.postRequest("cgi_buy_tool",_loc8_,this.buyToolFn);
         }
         else
         {
            this.preBuyToolType = param3;
            _loc9_ = "";
            _loc9_ = INI.getInstance().data.postUrl.@fbRequest;
            _loc10_ = {};
            _loc10_["app_key"] = LocalData.app_key;
            _loc10_["payitem"] = param3 * 10000 + param1 + "-" + param2 + "-" + param5;
            _loc10_["payvalue"] = 10 * param6 * param2;
            _loc10_["paytype"] = 0;
            _loc10_["accttype"] = 4;
            _loc10_["dnatime"] = 0;
            _loc10_["payinfo"] = param5;
            _loc10_["dnakey"] = 0;
            _loc10_["format"] = "JSON";
            this.fr.postRequest(_loc9_,_loc10_,this.qqBuyToolFn);
         }
      }

      private function buySeedFn(param1:Object) : void
      {
         var _loc2_:Number = NaN;
         var _loc3_:Number = NaN;
         var _loc4_:int = 0;
         var _loc5_:Boolean = false;
         var _loc6_:String = null;
         var _loc7_:Object = null;
         var _loc8_:String = null;
         if(this.checkErrorReturn(param1))
         {
            return;
         }
         if(param1["ecode"] == 0)
         {
            param1.money = -param1.money;
            _loc2_ = 0;
            _loc3_ = 0;
            _loc4_ = 0;
            while(_loc4_ < param1.animal.length)
            {
               if(GetCropID.getHouse(param1.animal[_loc4_]["cId"]) == "窝")
               {
                  _loc2_++;
               }
               else
               {
                  _loc3_++;
               }
               _loc4_++;
            }
            this.mainData.host["animal1"] += _loc2_;
            this.mainData.host["animal2"] += _loc3_;
            ViewControl.getInstance().dispatchEvent(new Event("animal_change"));
            this.addMoney(param1);
            this.addExp(param1);
            if(this.mainData.me)
            {
               this.addAnimal(param1);
            }
            _loc5_ = Command.getInstance().mainCommand.taskComp("goumai");
            if(!_loc5_)
            {
               _loc6_ = GetCropID.idToName(param1["animal"][0]["cId"]);
               _loc7_ = {
                  "money":Math.abs(param1["money"]),
                  "num":param1["num"],
                  "cName":_loc6_
               };
               _loc8_ = Language.replaceText("buySeedFnText",_loc7_);
               if(this._expAlertTip == false)
               {
                  if(param1["addExp"] != undefined && param1["addExp"] == 0)
                  {
                     if(param1["direction"] != undefined && param1["direction"] != "")
                     {
                        _loc8_ += "<br>(" + param1["direction"] + ")";
                        this._expAlertTip = true;
                     }
                  }
               }
               this.floatWindow(_loc8_);
            }
         }
         else
         {
            this.floatWindow(param1["direction"],"Exclamation");
         }
      }

      public function activeItem(param1:int) : void
      {
         var _loc2_:Object = {"itemId":param1};
         this.fr.postRequest("cgi_active_item",_loc2_,this.activeItemFn);
      }

      private function setWeather(param1:Object) : void
      {
         if(param1 == null)
         {
            return;
         }
         if(new Date().getHours() > 6 && new Date().getHours() < 20)
         {
            if(param1.hasOwnProperty("weatherId"))
            {
               if(param1["weatherId"] == 1)
               {
                  this.mainData.weather = Weather.SUNNY;
               }
               else if(param1["weatherId"] == 3)
               {
                  this.mainData.weather = Weather.RAIN;
               }
            }
            else
            {
               this.mainData.weather = Weather.SUNNY;
            }
         }
         else
         {
            this.mainData.weather = Weather.NIGHT;
         }
      }

      public function userReload() : void
      {
         if(this.setUserData != null)
         {
            this.setUser(this.setUserData);
         }
      }

      public function clearChat() : void
      {
         this.fr.postRequest("" + Version.value + "chat&act=clearChat",null,this.clearChatFn);
      }

      private function levelUp(param1:int) : void
      {
         var _loc2_:int = int(this.mainData.host["exp"]);
         var _loc3_:int = Math.sqrt((_loc2_ + 25) / 100) - 0.5;
         var _loc4_:int = Math.sqrt((_loc2_ + param1 + 25) / 100) - 0.5;
         if(_loc4_ > _loc3_)
         {
            this.fr.postRequest("cgi_levelup",{"level":_loc4_},this.levelUpFn);
         }
      }

      private function cftBuyDiyFn(param1:Object) : void
      {
         var _loc3_:int = 0;
         var _loc4_:Object = null;
         this.cftPostValue = null;
         var _loc2_:Object = {};
         if(param1["code"] == 0)
         {
            this.alertWindow("success","购买成功");
            _loc3_ = Number(param1["post_data"]["preType"]);
            if(_loc3_ == 6)
            {
               if(this.mainData.me)
               {
                  _loc4_ = this.mainData.items;
                  _loc4_["1"]["id"] = param1["post_data"]["itemId"];
                  this.mainData.items = _loc4_;
                  this.mainData.reloadUserItems = true;
               }
            }
            else
            {
               this.farmData.reloadUserSeed = true;
               this.mainData.reloadUserMaterial = true;
               if(_loc3_ == 5)
               {
                  this.getCropStatus("0",false);
               }
            }
         }
         else
         {
            _loc2_["code"] = param1["code"];
            _loc2_["direction"] = param1["msg"];
            _loc2_["channel"] = param1["channel"];
            _loc2_["subchannel"] = param1["subchannel"];
            _loc2_["dnaurl"] = param1["dnaurl"];
            _loc2_["pyaccount"] = param1["pyaccount"];
            _loc2_["bankurl"] = param1["bankurl"];
         }
         this.buyReturnFn(_loc2_);
      }

      private function checkAndReportSteal(param1:Object) : void
      {
         var _loc5_:* = undefined;
         if(this.mainData.me == true)
         {
            return;
         }
         if(this.mainData.friendStatus == null)
         {
            return;
         }
         var _loc2_:Boolean = false;
         var _loc3_:* = this.mainData.friendStatus[this.mainData.currentUserId];
         if(_loc3_ != null && _loc3_["tdo"] == 1)
         {
            _loc2_ = true;
         }
         var _loc4_:Boolean = false;
         if(param1 != null)
         {
            for(_loc5_ in param1)
            {
               if(param1[_loc5_] == 3)
               {
                  _loc4_ = true;
                  break;
               }
            }
         }
         if(_loc2_ != _loc4_)
         {
            EventRecorder.recordErrorEvent(EventRecorder.MC_STEALFLAG,0,EventRecorder.FAULT_FLAG_STEAL);
         }
         else
         {
            EventRecorder.recordSueecssEvent(EventRecorder.MC_STEALFLAG,0);
         }
      }

      public function setUser(param1:Object = null) : void
      {
         var _loc2_:Object = null;
         if(param1 == null || param1["me"] == true)
         {
            _loc2_ = this.mainData.host;
            this.setUserData = _loc2_;
            this.setUserData["me"] = true;
            this.getCropStatus();
         }
         else
         {
            this.setUserData = param1;
            this.getCropStatus(param1["uId"]);
            this.updateCache(this.mainData.friendStatus);
         }
      }

      private function updateTaskFn(param1:Object) : void
      {
         var _loc2_:Object = null;
         if(param1["ecode"] == 0)
         {
            this._tasking = false;
            if(this.checkErrorReturn(param1))
            {
               TaskData.getInstance().currentTask = {
                  "taskId":TaskData.TASK_MAX + 1,
                  "taskFlag":0
               };
               return;
            }
            if(!param1["task"])
            {
               TaskData.getInstance().currentTask = {
                  "taskId":TaskData.TASK_MAX + 1,
                  "taskFlag":0
               };
               return;
            }
            _loc2_ = param1["task"];
            TaskData.getInstance().updata = param1;
            TaskData.getInstance().currentTask = _loc2_;
         }
         else if(param1.hasOwnProperty("direction"))
         {
            this.floatWindow(param1["direction"]);
         }
         else if(param1.hasOwnProperty("errorContent"))
         {
            this.floatWindow(param1["errorContent"]);
         }
         else
         {
            this.floatWindow("系统繁忙，请稍候重试。");
         }
      }

      private function getUserCubFn(param1:Object) : void
      {
         var _loc4_:String = null;
         if(param1.hasOwnProperty("errorType"))
         {
            _loc4_ = param1["errorType"];
            if(_loc4_ == "IOError" || _loc4_ == "httpStatus" || _loc4_ == "timeOut")
            {
               this.mainData.userCubErr = "请求超时，" + "<a href=\'event:reload\'><u><font color=\'#ff6600\'>点击重试</font></u></a>";
               return;
            }
            if(param1.hasOwnProperty("direction"))
            {
               this.mainData.userCubErr = param1["direction"];
            }
            else
            {
               this.mainData.userCubErr = "系统繁忙，请稍候重试。";
            }
            return;
         }
         this.farmData.reloadUserSeed = false;
         this.mainData.userCubLoading = false;
         var _loc2_:Array = new Array();
         var _loc3_:int = 0;
         while(_loc3_ < param1.length)
         {
            if(param1[_loc3_]["amount"] > 0)
            {
               _loc2_.push(param1[_loc3_]);
            }
            if(param1[_loc3_]["tId"] == "40" && param1[_loc3_]["type"] == 4)
            {
               this.farmData.animalPackFood = param1[_loc3_];
            }
            _loc3_++;
         }
         this.farmData.userSeed = _loc2_;
         this.mainData.userCub = _loc2_;
      }

      private function vipReturnCheck() : void
      {
         var _loc1_:Object = MData.getInstance().mainData.host;
         if(_loc1_["yellowstatus"] == 0 && _loc1_["yellowlevel"] != 0)
         {
            this.getVipReturnGifts();
            return;
         }
      }

      private function friendSort(param1:Object, param2:Object) : Number
      {
         var _loc3_:String = this.mainData.sortField;
         if(int(param1["pf"]) > int(param2["pf"]))
         {
            return -1;
         }
         if(int(param1["pf"]) == int(param2["pf"]) && int(param1[_loc3_]) > int(param2[_loc3_]))
         {
            return -1;
         }
         if(int(param1["pf"]) == int(param2["pf"]) && int(param1[_loc3_]) == int(param2[_loc3_]))
         {
            return 0;
         }
         return 1;
      }

      private function welcome(param1:Object) : void
      {
         if(param1 != null)
         {
            this.mainData.welcome = Boolean(param1);
         }
      }

      public function setParade() : void
      {
         var _loc1_:Object = this.mainData.userFarmData;
         var _loc2_:ToolData = MData.getInstance().toolData;
         if(this.checkParade(_loc1_))
         {
            _loc2_.viewWhistleData = _loc1_["parade"];
            _loc2_.mpData = {"info":_loc1_["parade"]["i"]};
         }
         else
         {
            _loc2_.viewWhistleData = null;
         }
      }

      private function animalAttack(param1:Array) : Boolean
      {
         var _loc2_:int = 0;
         while(_loc2_ < param1.length)
         {
            if(param1[_loc2_]["fid"] == this.mainData.hostFid)
            {
               return true;
            }
            _loc2_++;
         }
         return false;
      }

      private function enterMill() : void
      {
         JSProxy.toApp(376,"");
      }

      public function hideHunter(param1:int) : void
      {
         var _loc2_:Object = {
            "itemId":param1,
            "action":"hide"
         };
         this.fr.postRequest("cgi_hide_guard",_loc2_,this.activeHunterFn);
      }

      private function openVipToMcFn(param1:Object) : void
      {
         if(param1["code"] == 1)
         {
            JSProxy.toApp(358,"");
         }
         else if(param1.hasOwnProperty("errorType"))
         {
            if(param1["direction"])
            {
               this.mainData.runError = param1["direction"];
            }
            if(param1["errorContent"])
            {
               this.mainData.runError = param1["errorContent"];
            }
         }
         else
         {
            this.mainData.runError = "尊敬的用户：您还没有注册QQ牧场，<a href=\'event:noreg\'><u><font color=\'#ff6600\'>点这里注册。</font></u></a>";
         }
      }

      private function saleFn(param1:Object) : void
      {
         var _loc3_:String = null;
         if(this.checkErrorReturn(param1))
         {
            return;
         }
         this.addMoney(param1);
         if(param1["cId"] > 2000 && param1["cId"] < 3000)
         {
            this.mainData.reloadUserMaterial = true;
            this.getUserMaterial();
         }
         else
         {
            this.mainData.reloadUserCrop = true;
            this.getUserCrop();
         }
         var _loc2_:Boolean = Command.getInstance().mainCommand.taskComp("maichu");
         if(_loc2_)
         {
            return;
         }
         if(param1.hasOwnProperty("direction") && StringUtil.trim(param1["direction"]) != "")
         {
            _loc3_ = param1["direction"];
         }
         else
         {
            _loc3_ = "操作成功！";
         }
         ViewControl.getInstance().dispatchEvent(new Event("get_money_ok"));
         this.floatWindow(_loc3_);
      }

      private function getUserMaterialFn(param1:Object) : void
      {
         var _loc3_:String = null;
         var _loc4_:Array = null;
         if(param1.hasOwnProperty("errorType"))
         {
            _loc3_ = param1["errorType"];
            if(_loc3_ == "IOError" || _loc3_ == "httpStatus" || _loc3_ == "timeOut")
            {
               this.mainData.userMaterialErr = "请求超时，" + "<a href=\'event:reload\'><u><font color=\'#ff6600\'>点击重试</font></u></a>";
               EventRecorder.recordErrorEvent(EventRecorder.MC_REPERTORY_ANIMAl,getTimer() - this.requestStartTime,EventRecorder.FAULT_ERROR);
               return;
            }
            if(_loc3_ == "session")
            {
               EventRecorder.recordErrorEvent(EventRecorder.MC_REPERTORY_ANIMAl,getTimer() - this.requestStartTime,EventRecorder.FAULT_SESSION);
               return;
            }
         }
         EventRecorder.recordSueecssEvent(EventRecorder.MC_REPERTORY_ANIMAl,getTimer() - this.requestStartTime);
         var _loc2_:Array = new Array();
         _loc2_ = _loc2_.concat(param1);
         _loc2_ = _loc2_.sort(this.cropSortBycId);
         this._tempMaterial = _loc2_;
         if(WildData.reloadCrystal || this._tempCrystal == null)
         {
            this.fr.postRequest2(GetCropID.getCommonUrlNc() + "cgi_farm_get_usercrystal",{"type":9},this.crystalFn);
         }
         else
         {
            this.mainData.userMaterialLoading = false;
            _loc4_ = [];
            _loc4_ = this._tempMaterial.concat(this._tempCrystal);
            this.mainData.userMaterial = _loc4_;
         }
      }

      public function getUserHunters() : void
      {
         this.mainData.userItemLoading = true;
         this.fr.postRequest2("cgi_get_userguard",null,this.getUserHuntersFn);
      }

      public function floatWindow(param1:String, param2:String = "info") : void
      {
         var tip:Sprite = null;
         var t:String = param1;
         var type:String = param2;
         if(this.lastTip)
         {
            TweenLite.goto(this.lastTip,0.3,{
               "alpha":0,
               "y":this.lastTip.y - 50,
               "onCompleteParams":[this.lastTip],
               "onComplete":this.onFloatWindowComplete
            });
            this.lastTip = null;
         }
         if(type == "hunter")
         {
            tip = this.getFloatTipHunter(t,this.mainData.hunter["id"]);
         }
         else if(type == "activity")
         {
            tip = this.getFloatTipActivity(t);
         }
         else if(type == "Exclamation")
         {
            tip = this.getFloatTip(t,"ErrorFloatWindow");
         }
         else
         {
            tip = this.getFloatTip(t);
         }
         if(tip)
         {
            tip.alpha = 0;
            this.lastTip = tip;
            PopUpManager.addPopUp(tip);
            TweenLite.goto(tip,0.3,{
               "alpha":1,
               "y":tip.y - 50
            });
            TweenLite.delayedCall(2,function():void
            {
               TweenLite.goto(tip,0.3,{
                  "alpha":0,
                  "y":tip.y - 50,
                  "onCompleteParams":[tip],
                  "onComplete":onFloatWindowComplete
               });
            });
         }
      }

      private function getCdKeyFn(param1:Object) : void
      {
         if(param1.hasOwnProperty("code"))
         {
            this.alertWindow(param1.title,param1.direction);
         }
         else
         {
            this.mainData.giftPackage = param1;
            this.addReward(param1["item"]);
            if(param1.hasOwnProperty("vipItem") && param1["vipItem"] != false)
            {
               this.addReward(param1["vipItem"]);
            }
         }
      }

      private function cropSortBycId(param1:Object, param2:Object) : int
      {
         if(int(param1["cId"]) <= int(param2["cId"]))
         {
            return -1;
         }
         return 1;
      }

      private function updateGrassCutter() : void
      {
         GrassCutter.getInstance().addFood(null);
      }

      public function buyThingByCFT(param1:int, param2:String, param3:int, param4:int = 1) : void
      {
         this.cftPostValue = {};
         this.cftPostValue["app_key"] = "QQMCZZ";
         this.cftPostValue["payitem"] = param3 * 10000 + param1 + "-" + param4 + "-" + param2;
         this.cftPostValue["paytype"] = 0;
         this.cftPostValue["payinfo"] = param2;
         this.cftPostValue["channel"] = "tenpay";
         this.cftPostValue["subchannel"] = 7001;
         this.cftPostValue["format"] = "JSON";
         this.cftPostValue["preType"] = param3;
         this.cftPostValue["itemId"] = param1;
         this.buyCFTConfirm();
      }

      public function checkParade(param1:Object) : Boolean
      {
         var _loc4_:Number = NaN;
         var _loc5_:Boolean = false;
         var _loc6_:int = 0;
         var _loc2_:Array = param1["animal"];
         var _loc3_:ToolData = MData.getInstance().toolData;
         if(Boolean(param1["parade"]) && param1["parade"]["p"] != 0)
         {
            _loc4_ = 0;
            _loc5_ = false;
            _loc6_ = 0;
            while(_loc6_ < _loc2_.length)
            {
               if(_loc2_[_loc6_].status == 4)
               {
                  _loc5_ = true;
                  break;
               }
               if(_loc2_[_loc6_].buyTime != 0)
               {
                  _loc4_++;
               }
               _loc6_++;
            }
            if(!_loc5_ && param1["parade"]["p"] == 1 && _loc4_ >= 5)
            {
               _loc3_.paradeError = null;
               return true;
            }
            if(!_loc5_ && param1["parade"]["p"] == 2 && _loc4_ >= 5)
            {
               _loc3_.paradeError = null;
               return true;
            }
            if(!_loc5_ && param1["parade"]["p"] == 3 && (_loc4_ == 6 || _loc4_ == 10 || _loc4_ == 15))
            {
               _loc3_.paradeError = null;
               return true;
            }
            if(!_loc5_ && param1["parade"]["p"] == 4 && (_loc4_ == 9 || _loc4_ == 16))
            {
               _loc3_.paradeError = null;
               return true;
            }
            if(!_loc5_ && param1["parade"]["p"] == 5 && (_loc4_ == 8 || _loc4_ == 12 || _loc4_ == 16))
            {
               _loc3_.paradeError = null;
               return true;
            }
            if(_loc5_)
            {
               _loc3_.paradeError = "动物生产中，请稍后。";
            }
            else
            {
               _loc3_.paradeError = "主人没有设置欢迎队形。";
            }
            return false;
         }
         _loc3_.paradeError = "主人没有设置欢迎队形。";
         return false;
      }

      private function setMarkList(param1:Object) : void
      {
         var _loc2_:Array = this.mainData.friendList;
         var _loc3_:int = int(this.mainData.friendList.length);
         var _loc4_:int = 0;
         while(_loc4_ < _loc3_)
         {
            if(param1[_loc2_[_loc4_]["uin"]])
            {
               _loc2_[_loc4_]["userName"] = param1[_loc2_[_loc4_]["uin"]];
            }
            _loc4_++;
         }
         this.mainData.updateMark = param1;
         var _loc5_:Number = CommonData.serverTime + 86400 * 3;
         this.localData.setObject("mc" + Version.value + this.mainData.host["uId"],_loc2_,_loc5_,true);
      }

      private function onComp(param1:Event) : void
      {
         MaterialLib.getInstance().push(param1.currentTarget.applicationDomain);
         if(this._taskData["taskId"] == 0)
         {
            this.welcome(true);
         }
         TaskData.getInstance().currentTask = {
            "taskId":this._taskData["taskId"],
            "taskFlag":this._taskData["taskFlag"]
         };
      }

      private function cropSortBylv(param1:Object, param2:Object) : int
      {
         if(int(param1["lv"]) <= int(param2["lv"]))
         {
            return -1;
         }
         return 1;
      }

      private function setBadInfo(param1:Object) : void
      {
         var _loc2_:Number = NaN;
         var _loc3_:Number = NaN;
         if(!param1 || !param1[0])
         {
            this.farmData.flyData = {
               "num":0,
               "type":1,
               "flyNum1":0,
               "flyNum2":0,
               "mynum":0
            };
         }
         else
         {
            _loc2_ = Math.floor(param1[0]["num"] / 2);
            _loc3_ = param1[0]["num"] - _loc2_;
            param1[0]["flyNum1"] = _loc2_;
            param1[0]["flyNum2"] = _loc3_;
            this.farmData.flyData = param1[0];
         }
         if(!param1 || !param1[1])
         {
            this.farmData.bbData = {
               "num":0,
               "type":2,
               "mynum":0
            };
         }
         else
         {
            this.farmData.bbData = param1[1];
         }
      }

      private function setEenemyInfo(param1:Object) : void
      {
         this.farmData.enemyData = param1;
      }

      public function getGifts() : void
      {
         this.fr.postRequest("cgi_get_gifts",null,this.getPackageFn);
      }

      private function activeHunterFn(param1:Object) : void
      {
         var _loc2_:int = 0;
         var _loc3_:String = null;
         var _loc4_:Array = null;
         var _loc5_:int = 0;
         if(this.checkErrorReturn(param1))
         {
            return;
         }
         if(param1["code"] == 1)
         {
            _loc2_ = param1["post_data"]["action"] == "active" ? 1 : 0;
            _loc3_ = param1["post_data"]["itemId"];
            this.mainData.hunter = {
               "id":_loc3_,
               "t":param1["itemValidTime"],
               "name":param1["itemName"],
               "used":_loc2_
            };
            _loc4_ = this.mainData.userHunters;
            _loc5_ = 0;
            while(_loc5_ < _loc4_.length)
            {
               if(_loc4_[_loc5_]["itemId"] == _loc3_)
               {
                  _loc4_[_loc5_]["status"] = _loc2_;
               }
               else
               {
                  _loc4_[_loc5_]["status"] = 0;
               }
               _loc5_++;
            }
            this.mainData.userHunters = _loc4_;
         }
      }

      private function buyDiyFn(param1:Object) : void
      {
         var _loc2_:Object = null;
         var _loc3_:Array = null;
         var _loc4_:Object = null;
         if(this.checkErrorReturn(param1))
         {
            return;
         }
         if(param1["code"] == 1)
         {
            this.mainData.reloadUserItems = true;
            this.floatWindow("购买装饰成功");
            this.addMoney(param1);
            this.addFB(param1);
            this.addExp(param1);
            this.addLevelReward(param1);
            if(this.mainData.diyInfo != null)
            {
               _loc3_ = this.mainData.diyInfo;
               for each(_loc4_ in _loc3_)
               {
                  if(int(_loc4_["itemId"]) == int(param1.post_data["itemId"]))
                  {
                     _loc4_["owned"] = 1;
                     break;
                  }
               }
               this.mainData.diyInfo = _loc3_.concat();
            }
            if(this.mainData.me)
            {
               _loc2_ = this.mainData.items;
               _loc2_["1"]["id"] = param1.post_data["itemId"];
               _loc2_["1"]["skin"] = param1.post_data["skinBool"];
               _loc2_["1"]["msg"] = param1.post_data["msgBool"];
               this.setItems(_loc2_);
            }
         }
      }

      public function setExpressUser(param1:Object, param2:Boolean = false) : void
      {
         if(param2 || param1["uId"] == MData.getInstance().mainData.host.uId)
         {
            JSProxy.toApp(353,"");
         }
         else
         {
            JSProxy.toApp(353,com.adobe.serialization.json.JSON.encode(param1));
         }
      }

      public function forDNA(param1:String, param2:String) : void
      {
         var _loc3_:* = LocalData.lastRequestValue;
         if(_loc3_)
         {
            LocalData.lastRequestValue["dnakey"] = param1;
            LocalData.lastRequestValue["dnatime"] = param2;
         }
         else
         {
            LocalData.lastRequestValue = {
               "dnakey":param1,
               "dnatime":param2
            };
         }
         LocalData.lastRequestFn(LocalData.lastRequestUrl,LocalData.lastRequestValue,LocalData.lastRequestHandle);
      }

      public function showWin(param1:String = "cdkey") : void
      {
         var _loc2_:BaseWindow = null;
         if(param1 == "validateCode")
         {
            _loc2_ = new ValidateCodeWindow();
         }
         WControl.open(_loc2_);
      }

      public function getCostInfo(param1:Function, param2:Function) : void
      {
         var _loc3_:Object = {"uin":this.mainData.currentUserUin};
         this.fr.postRequest2("" + this.version + "cgi_farm_exchange",null,param1);
         this.fr.postRequest2("fcg_ws_get_costfeeds",_loc3_,param2);
      }

      public function friendBackEndPage(param1:String = "") : void
      {
         this.mainData.showFriendPage = 1;
         this.pageHandler();
      }

      private function unread(param1:int, param2:int, param3:int, param4:int) : void
      {
         var _loc5_:Object = new Object();
         _loc5_["a"] = param1;
         _loc5_["b"] = param2;
         _loc5_["c"] = param3;
         _loc5_["d"] = MainData.gift || param4;
         this.mainData.unreadData = _loc5_;
      }

      public function clearLog() : void
      {
         this.fr.postRequest("cgi_clear_log",null,this.clearLogFn);
      }

      public function getAllInfo(param1:Boolean, param2:int) : void
      {
         var _loc3_:Object = null;
         var _loc4_:Boolean = true;
         if(this.profile["user"] == undefined)
         {
            _loc4_ = false;
         }
         LocalData.isMe = param1;
         if(!param1)
         {
            _loc3_ = {"uId":MData.getInstance().mainData.currentUserId};
         }
         else
         {
            _loc3_ = {"uId":MData.getInstance().mainData.host["uId"]};
         }
         this.profile = {};
         if(param2 == 0)
         {
            if(!MainData.loadedProfile)
            {
               this.mainData.profileLoading = true;
               _loc3_.profile = 1;
               this.fr.postRequest2("cgi_get_user_info",_loc3_,this.getAllInfoFn);
            }
         }
         else if(param2 == 1)
         {
            if(!MainData.loadedProfile)
            {
               this.mainData.profileLoading = true;
               _loc3_.profile = 1;
               this.fr.postRequest2("cgi_get_user_info",_loc3_,this.getAllInfoFn);
            }
            if(!MainData.loadedMsg)
            {
               this.mainData.profileLoading = true;
               _loc3_.msg = 1;
               this.fr.postRequest2(INI.getInstance().getPostUrl() + "chat&act=getAllInfo",_loc3_,this.getAllInfoFn);
            }
         }
         else if(!MainData.loadedSystemMsg)
         {
            if(!_loc4_)
            {
               this.mainData.profileLoading = true;
               _loc3_.profile = 1;
               this.fr.postRequest2("cgi_get_user_info",_loc3_,this.getAllInfoFn);
               this.isFirstLoadSysMsg = true;
            }
            else
            {
               this.mainData.profileLoading = true;
               _loc3_.uin = MData.getInstance().mainData.host["uin"];
               _loc3_.opuin = MData.getInstance().mainData.host["uin"];
               _loc3_.appid = "358";
               _loc3_.msgnum = "300";
               this.fr.postRequest2("" + Version.value + "sysmsg_select",_loc3_,this.getAllInfoFn);
            }
         }
      }

      public function addExp(param1:Object) : void
      {
         if(param1.hasOwnProperty("addExp") && param1["addExp"] != 0)
         {
            this.mainData.host["exp"] = int(this.mainData.host["exp"]) + int(param1["addExp"]);
            this.mainData.addExp = param1["addExp"];
         }
      }

      private function pageHandler() : void
      {
         var _loc4_:Array = null;
         var _loc5_:int = 0;
         var _loc6_:Array = null;
         var _loc7_:int = 0;
         var _loc1_:int = this.mainData.friendPageNum;
         var _loc2_:int = (this.mainData.showFriendPage - 1) * _loc1_;
         var _loc3_:int = this.mainData.showFriendPage * _loc1_;
         if(_loc3_ > this.mainData.friendList.length)
         {
            _loc3_ = int(this.mainData.friendList.length);
         }
         if(this.mainData.searchFriendValue != "")
         {
            this.mainData.showFriendList = this.mainData.filterFriendList.slice(_loc2_,_loc3_);
         }
         else
         {
            this.mainData.showFriendList = this.mainData.friendList.slice(_loc2_,_loc3_);
         }
         if(this._neddUpdateHead)
         {
            this.updateHeadList();
         }
         else if(Version.value == Version.QZONE)
         {
            _loc4_ = this.mainData.showFriendList;
            _loc5_ = int(this.mainData.showFriendList.length);
            _loc6_ = [];
            _loc7_ = 0;
            while(_loc7_ < _loc5_)
            {
               if(!_loc4_[_loc7_]["headPic"])
               {
                  _loc6_.push(_loc4_[_loc7_]["uin"]);
               }
               _loc7_++;
            }
            if(_loc6_.length > 0)
            {
               JSProxy.getHeadList(_loc6_,25,this.setHeadList);
            }
         }
      }

      private function onIOError(param1:IOErrorEvent) : void
      {
         TaskData.getInstance().currentTask = {
            "taskId":TaskData.TASK_MAX + 1,
            "taskFlag":0
         };
      }

      private function getHistoryFn(param1:Object) : void
      {
         if(param1.hasOwnProperty("errorType"))
         {
            this.historyCallBackFn(null);
         }
         else
         {
            this.historyCallBackFn(param1);
         }
      }

      public function preview(param1:Object) : void
      {
         var _loc2_:Object = null;
         if(param1 != null)
         {
            _loc2_ = this.mainData.items;
            this._itemId = _loc2_["1"]["id"];
            _loc2_["1"]["id"] = param1["itemId"];
            this.mainData.items = _loc2_;
         }
         else
         {
            _loc2_ = this.mainData.items;
            _loc2_["1"]["id"] = this._itemId;
            this.mainData.items = _loc2_;
         }
      }

      private function saleAllMaterialFn(param1:Object) : void
      {
         var _loc3_:String = null;
         if(this.checkErrorReturn(param1))
         {
            return;
         }
         this.mainData.reloadUserMaterial = true;
         WildData.reloadCrystal = true;
         this.addMoney(param1);
         this.getUserMaterial();
         var _loc2_:Boolean = Command.getInstance().mainCommand.taskComp("maichu");
         if(_loc2_)
         {
            return;
         }
         if(param1.hasOwnProperty("direction") && StringUtil.trim(param1["direction"]) != "")
         {
            this.floatWindow(param1["direction"]);
         }
         else
         {
            this.floatWindow(Language.replaceText("saleAllMaterialFnText",{"money":param1["money"]}));
         }
      }

      public function getNotice(param1:Function) : void
      {
         var _loc2_:int = 0;
         if(Version.value == "qzone")
         {
            _loc2_ = 1;
         }
         else
         {
            _loc2_ = 2;
         }
         this.fr.getRequest("" + Version.value + "cgi_farm_get_common_notice&serviceId=" + _loc2_ + "&appId=358",{"uin":this.mainData.host["uin"]},param1);
      }

      public function onInGamePreCheckSuccess(param1:Object) : void
      {
         var _loc2_:int = 0;
         if(param1["code"] == "1")
         {
            this.buyTime = getTimer();
            if(param1["local"] == 1)
            {
               this.onInGameBuySuccess(param1);
               return;
            }
            this.alertWindow("error","本地版本不支持元宝充值，请使用金币购买。");
         }
         else
         {
            this.alertWindow("error",param1["direction"]);
         }
      }

      private function hasMe(param1:Object) : Boolean
      {
         var _loc3_:Object = null;
         var _loc2_:Number = Number(this.mainData.host["uId"]);
         if(!param1)
         {
            return false;
         }
         for each(_loc3_ in param1)
         {
            if(_loc3_["userId"] == _loc2_ || _loc3_["uId"] == _loc2_)
            {
               return true;
            }
         }
         return false;
      }

      private function getUserHuntersFn(param1:Object) : void
      {
         var _loc3_:String = null;
         if(param1.hasOwnProperty("errorType"))
         {
            _loc3_ = param1["errorType"];
            if(_loc3_ == "IOError" || _loc3_ == "httpStatus" || _loc3_ == "timeOut")
            {
               this.mainData.userItemErr = "请求超时，" + "<a href=\'event:reload\'><u><font color=\'#ff6600\'>点击重试</font></u></a>";
               return;
            }
         }
         this.mainData.userItemLoading = false;
         var _loc2_:Array = new Array();
         _loc2_ = _loc2_.concat(param1);
         this.mainData.userHunters = _loc2_;
      }

      public function resetUnread(param1:String) : void
      {
         var _loc2_:Object = this.mainData.unreadData;
         if(param1 == "true")
         {
            _loc2_["a"] = 1;
         }
         else
         {
            _loc2_["a"] = 0;
         }
         this.mainData.unreadData = _loc2_;
      }

      private function activeItemFn(param1:Object) : void
      {
         var _loc2_:Object = null;
         var _loc3_:Array = null;
         var _loc4_:int = 0;
         if(this.checkErrorReturn(param1))
         {
            return;
         }
         if(param1["code"] == 1)
         {
            _loc2_ = this.mainData.items;
            _loc2_["1"]["id"] = param1["id"];
            _loc2_["1"]["skin"] = param1["skin"];
            _loc2_["1"]["msg"] = param1["msg"];
            this.setItems(_loc2_);
            _loc3_ = this.mainData.userItems;
            _loc4_ = 0;
            while(_loc4_ < _loc3_.length)
            {
               if(_loc3_[_loc4_]["itemId"] == param1["id"] && _loc3_[_loc4_]["yellowtype"] == 0)
               {
                  _loc3_[_loc4_]["status"] = 1;
               }
               else
               {
                  _loc3_[_loc4_]["status"] = 0;
               }
               _loc4_++;
            }
            this.mainData.userItems = _loc3_;
         }
      }

      private function getSeedInfoFn(param1:Object) : void
      {
         var _loc2_:String = null;
         var _loc3_:Array = null;
         if(param1.hasOwnProperty("errorType"))
         {
            _loc2_ = param1["errorType"];
            if(_loc2_ == "IOError" || _loc2_ == "httpStatus" || _loc2_ == "timeOut")
            {
               this.mainData.shopSeedErr = "请求超时，" + "<a href=\'event:reload\'><u><font color=\'#ff6600\'>点击重试</font></u></a>";
               EventRecorder.recordErrorEvent(EventRecorder.MC_ANIMAL,getTimer() - this.requestStartTime,EventRecorder.FAULT_ERROR);
               return;
            }
         }
         else
         {
            EventRecorder.recordSueecssEvent(EventRecorder.MC_ANIMAL,getTimer() - this.requestStartTime);
            this.mainData.shopSeedLoading = false;
            _loc3_ = new Array();
            this.mainData.seedInfo = _loc3_.concat(param1);
            this.cacheSeedsData = this.mainData.seedInfo;
         }
      }

      private function qqBuyDiyFn(param1:Object) : void
      {
         var _loc2_:Object = {};
         if(param1["code"] == 0)
         {
            if(this.buyDiyData.hasOwnProperty("exp") && this.buyDiyData["exp"] != 0)
            {
               this.levelUp(this.buyDiyData["exp"]);
               this.addExp(this.buyDiyData);
               this.mainData.reloadUserItems = true;
               this.alertWindow("success","购买装饰成功");
            }
         }
         else
         {
            _loc2_["code"] = 0;
            _loc2_["direction"] = param1["msg"];
         }
         this.buyDiyFn(_loc2_);
      }

      private function sendChatFn(param1:Object) : void
      {
         var _loc2_:Object = null;
         if(param1["code"])
         {
            _loc2_ = this.mainData.profile;
            if(_loc2_ != null)
            {
               _loc2_["chat"] = param1["chat"];
            }
            this.mainData.profile = _loc2_;
         }
      }

      public function saleAll() : void
      {
         var _loc1_:Object = {"saleAll":1};
         this.fr.postRequest("cgi_sale_product",_loc1_,this.saleAllFn);
      }

      public function buyFoodFn(param1:Object) : void
      {
         var data:Object = param1;
         if(this.checkErrorReturn(data))
         {
            return;
         }
         MData.getInstance().farmData.reloadUserSeed = true;
         data.money = -data.money;
         this.addMoney(data);
         this.floatWindow(data["alert"]);
         setTimeout(function():void
         {
            farmData.farmOperate = {
               "text":"已放入物品包",
               "type":"toolBar",
               "toolName":"package"
            };
         },2000);
      }

      private function setFarmlandData(param1:Array) : void
      {
         this.mainData.animalData = param1;
      }

      public function updateTask() : void
      {
         if(this._tasking)
         {
            return;
         }
         this._tasking = true;
         this.fr.postRequest("cgi_up_task",{"act":2},this.updateTaskFn);
      }

      public function gotoPlayMill() : void
      {
         var _loc1_:Number = this.mainData.millLimitYDLevel;
         if(this.mainData.millOpened)
         {
            this.enterMill();
         }
         else if(this.mainData.host["yellowstatus"] >= 1 || _loc1_ == 0)
         {
            if(_loc1_ == 1 && (this.mainData.host["yellowlevel"] == 0 || this.mainData.host["yellowlevel"] == 1))
            {
               this.enterMill();
            }
            else if(this.mainData.host["yellowlevel"] >= _loc1_)
            {
               this.enterMill();
            }
            else
            {
               this.showMillInfo(_loc1_);
            }
         }
         else
         {
            this.showMillInfo(_loc1_);
         }
      }

      private function getFloatTipHunter(param1:String, param2:uint) : Sprite
      {
         var _loc3_:Sprite = null;
         var _loc4_:MovieClip = null;
         var _loc5_:Loader = null;
         var _loc6_:TextField = null;
         var _loc7_:TextFormat = null;
         if(!this.lastTip)
         {
            _loc3_ = new Sprite();
            _loc3_.mouseChildren = false;
            _loc3_.mouseEnabled = false;
            _loc4_ = MaterialLib.getInstance().getMaterial("FloatingWindowBg2") as MovieClip;
            _loc5_ = new Loader();
            _loc4_.addChild(_loc5_);
            _loc5_.load(new URLRequest(GetCropID.getHunterPicUrl("CatchImg_" + param2,true)));
            _loc5_.x = _loc5_.y = 13;
            _loc3_.addChild(_loc4_);
            _loc7_ = new TextFormat("Verdana",14,8999699,null,null,null,null,null,TextFormatAlign.LEFT);
            _loc7_.leading = 5;
            _loc6_ = new TextField();
            _loc6_.selectable = false;
            _loc6_.defaultTextFormat = _loc7_;
            _loc6_.width = 220;
            _loc6_.x = 102;
            _loc6_.y = 45;
            _loc6_.wordWrap = true;
            _loc6_.multiline = true;
            _loc6_.htmlText = param1;
            _loc3_.addChild(_loc6_);
         }
         return _loc3_;
      }

      private function unLockCropFn(param1:Object) : void
      {
         var _loc2_:Boolean = false;
         var _loc3_:Array = null;
         var _loc4_:int = 0;
         trace("unlock " + param1["post_data"]["cId"]);
         this.debugLock();
         if(this.checkErrorReturn(param1))
         {
            return;
         }
         if(param1["code"])
         {
            if(Boolean(param1["post_data"].hasOwnProperty("type")) && param1["post_data"]["type"] == "11")
            {
               _loc2_ = true;
            }
            else
            {
               _loc2_ = false;
            }
            if(_loc2_)
            {
               _loc3_ = this.mainData.userMaterial;
            }
            else
            {
               _loc3_ = this.mainData.userCrop;
            }
            _loc4_ = 0;
            while(_loc4_ < _loc3_.length)
            {
               if(_loc3_[_loc4_]["cId"] == param1["post_data"]["cId"])
               {
                  if(_loc2_)
                  {
                     _loc3_[_loc4_]["isLock"] = 0;
                  }
                  else
                  {
                     _loc3_[_loc4_]["lock"] = 0;
                  }
                  if(_loc2_)
                  {
                     this.mainData.userMaterial = _loc3_;
                  }
                  else
                  {
                     this.mainData.userCrop = _loc3_;
                  }
                  break;
               }
               _loc4_++;
            }
            this.mainData.lockCropData = {
               "lock":0,
               "cId":param1["post_data"]["cId"],
               "type":param1["type"]
            };
         }
         this.debugLock();
      }

      private function addAnimal(param1:Object) : void
      {
         this.mainData.animalAddArray = param1.animal;
      }

      public function getUserItems() : void
      {
         if(this.mainData.reloadUserItems)
         {
            this.mainData.userItemLoading = true;
            this.fr.postRequest2("cgi_get_useritem",null,this.getUserItemsFn);
         }
         else
         {
            this.getUserItemsFn(this.mainData.userItems);
         }
      }
   }
}
