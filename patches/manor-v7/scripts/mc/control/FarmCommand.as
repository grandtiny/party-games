package mc.control
{
   import com.adobe.utils.StringUtil;
   import common.LocalData;
   import flash.display.*;
   import flash.events.Event;
   import flash.events.EventDispatcher;
   import flash.events.TimerEvent;
   import flash.utils.Timer;
   import flash.utils.clearTimeout;
   import flash.utils.getTimer;
   import flash.utils.setTimeout;
   import mc.FBridge.EventRecorder;
   import mc.FBridge.FRequest;
   import mc.FBridge.FeartureManager;
   import mc.FBridge.RequestManager;
   import mc.events.WindowEvent;
   import mc.model.FarmData;
   import mc.model.MData;
   import mc.model.MainData;
   import mc.model.ProductData;
   import mc.view.farm.GetCropID;
   import mc.view.farm.Research.ResearchEvent;
   import mc.view.farm.Research.ResearchModel;
   import mc.view.farm.animals.Animal;
   import mc.view.farm.animals.AnimalManager;
   import mc.view.main.WindowControl.WControl;
   import mc.view.main.cursor.Cursor;
   import mc.view.main.leftInfo.REGiftWindow;
   import mc.view.main.leftInfo.SpringFirecraker2012.SpringFirecraker2012GetGift;
   
   public class FarmCommand extends EventDispatcher
   {
      
      private var loopTimer:Timer;
      
      private var mainData:MainData;
      
      private var requestStartTime:Number;
      
      private var requestTime:Object = {};
      
      private var farmData:FarmData;
      
      public var isShouhuo:Boolean = false;
      
      private var harvestList:Array;
      
      private var productData:ProductData;
      
      private var fr:FRequest;
      
      private var _theftReturn:Object;
      
      private var looptime:Number = 600;
      
      private var _feedAnimalIndex:Number = -1;
      
      private var addFoodTimeoutId:Number;
      
      private var _flyData:Object;
      
      public function FarmCommand()
      {
         super();
         this.fr = FRequest.getInstance();
         this.farmData = MData.getInstance().farmData;
         this.mainData = MData.getInstance().mainData;
         this.productData = MData.getInstance().productData;
         this.mainData.addEventListener(MainData.CURRENT_USER_CHANGE,this.currentUserChange,false,0,true);
         ResearchModel.gi().addEventListener(ResearchEvent.UPDATEDENSHED_SUCESS,this.updateDenShedSuccess,false,0,true);
      }
      
      private function useToolsCanFn(param1:Object) : void
      {
         var _loc2_:Array = null;
         var _loc3_:Object = null;
         if(param1["ecode"] == 0)
         {
            if(param1.hasOwnProperty("serial"))
            {
               if(this.checkErrorReturn2(param1,"animal",null,param1["serial"]))
               {
                  return;
               }
            }
            else if(this.checkErrorReturn2(param1,"animal",null,this._feedAnimalIndex))
            {
               return;
            }
            this.mainData = MData.getInstance().mainData;
            _loc2_ = this.mainData.animalData;
            if(param1.hasOwnProperty("animal"))
            {
               _loc2_[param1["animal"]["serial"]] = param1["animal"];
               this.mainData.nextStatusAnimal = param1["animal"];
            }
            FarmData.feedAnimalReturn = param1;
            ViewControl.getInstance().dispatchEvent(new Event("canFeed"));
            _loc3_ = this.getSeed(param1["post_data"]["tid"],"7");
            --_loc3_["amount"];
            if(_loc3_["amount"] <= 0)
            {
               Cursor.setCursor("CursorArrow");
               this.farmData.reloadUserSeed = true;
            }
         }
         else if(param1.hasOwnProperty("direction"))
         {
            Command.getInstance().mainCommand.floatWindow(param1["direction"]);
         }
         else if(param1.hasOwnProperty("errorContent"))
         {
            Command.getInstance().mainCommand.floatWindow(param1["errorContent"]);
         }
         else
         {
            Command.getInstance().mainCommand.floatWindow("系统繁忙，请稍候重试");
         }
      }
      
      private function checkErrorReturn2(param1:Object, param2:String, param3:String = null, param4:Number = -1) : Boolean
      {
         var _loc5_:String = null;
         if(param1.hasOwnProperty("errorType"))
         {
            _loc5_ = param1["errorType"];
            if(_loc5_ == "validateCode")
            {
               return true;
            }
            if(_loc5_ == "IOError" || _loc5_ == "httpStatus" || _loc5_ == "timeOut")
            {
               if(param3)
               {
                  EventRecorder.recordErrorEvent(param3,getTimer() - this.requestStartTime,EventRecorder.FAULT_ERROR);
               }
               this.farmData.farmOperate = {
                  "text":"请求超时，稍后再试。",
                  "type":param2
               };
               return true;
            }
            if(_loc5_ == "system")
            {
               this.farmData.farmOperate = {
                  "text":param1["errorContent"],
                  "type":param2
               };
               return true;
            }
            if(_loc5_ != "session" && param1.hasOwnProperty("errorContent") && StringUtil.trim(param1["errorContent"]) != "")
            {
               this.farmData.farmOperate = {
                  "text":param1["errorContent"],
                  "type":param2,
                  "serial":param4
               };
               return true;
            }
            return true;
         }
         return false;
      }
      
      private function reclaimFn(param1:Object) : void
      {
         var _loc2_:ResearchEvent = new ResearchEvent(ResearchEvent.UPDATEDENSHED_SUCESS);
         _loc2_.data = param1;
         ResearchModel.gi().dispatchEvent(_loc2_);
         EventRecorder.recordSueecssEvent(EventRecorder.DENSHED_SUCCESS_BUYBYGOLD,0,null,10);
      }
      
      public function addFly(param1:Number) : void
      {
         var _loc2_:Object = {
            "uId":this.mainData.currentUserId,
            "num":param1,
            "type":1
         };
         this.fr.postRequest("cgi_demolish_pasture",_loc2_,this.flyFn);
         ViewControl.getInstance().addEventListener("updateFly",this.updateFly);
      }
      
      public function useTools(param1:Number, param2:Object) : void
      {
         var _loc5_:XML = null;
         var _loc3_:Object = this.mainData.animalData[param1];
         var _loc4_:int = int(param2["tId"]);
         if(param2["type"] == 4)
         {
            _loc5_ = GetCropID.toolToAnimal(String(_loc4_));
            this._feedAnimalIndex = param1;
            if(_loc3_["cId"] != _loc5_.@id)
            {
               this.farmData.farmOperate = {
                  "text":"只能对" + _loc5_.@name + "喂这个。",
                  "type":"animal",
                  "serial":param1
               };
               return;
            }
            if(_loc3_.status == FarmData.ANIMAL_SHENGCHAN)
            {
               this.farmData.farmOperate = {
                  "text":"不能对生产中的动物操作",
                  "type":"animal",
                  "serial":param1
               };
               return;
            }
            if(_loc3_.status == FarmData.ANIMAL_SHOUHUO)
            {
               this.farmData.farmOperate = {
                  "text":"不能对收获期的动物操作",
                  "type":"animal",
                  "serial":param1
               };
               return;
            }
            if(FarmData.sFeedTotalError)
            {
               this.farmData.farmOperate = {
                  "text":FarmData.sFeedTotalError,
                  "type":"animal",
                  "serial":param1
               };
               return;
            }
            this.fr.postRequest2("cgi_feed_special",{
               "serial":_loc3_.serial,
               "uId":this.mainData.currentUserId,
               "tid":_loc4_
            },this.useToolsFn);
         }
         if(param2["type"] == 7)
         {
            this._feedAnimalIndex = param1;
            if(_loc3_.status == FarmData.ANIMAL_DAICHAN)
            {
               this.farmData.farmOperate = {
                  "text":"当前状态不能使用罐头",
                  "type":"animal",
                  "serial":param1
               };
               return;
            }
            if(_loc3_.status == FarmData.ANIMAL_SHENGCHAN)
            {
               this.farmData.farmOperate = {
                  "text":"不能对生产中的动物操作",
                  "type":"animal",
                  "serial":param1
               };
               return;
            }
            if(_loc3_.status == FarmData.ANIMAL_SHOUHUO)
            {
               this.farmData.farmOperate = {
                  "text":"不能对收获期的动物操作",
                  "type":"animal",
                  "serial":param1
               };
               return;
            }
            this.fr.postRequest2("cgi_feedcan",{
               "serial":_loc3_.serial,
               "uId":this.mainData.currentUserId,
               "tid":_loc4_
            },this.useToolsCanFn);
         }
      }
      
      private function updateDenShedSuccess(param1:ResearchEvent) : void
      {
         var _loc2_:Object = param1.data;
         if(this.checkErrorReturn(_loc2_))
         {
            ViewControl.getInstance().dispatchEvent(new Event("removeAni"));
            return;
         }
         if(!_loc2_.hasOwnProperty("qd"))
         {
            this.addMoney(_loc2_);
         }
         Command.getInstance().mainCommand.setItems(_loc2_);
         if(_loc2_.hasOwnProperty("3"))
         {
            ResearchModel.gi().DenShedLevel = {
               "den":_loc2_["2"]["lv"],
               "shed":_loc2_["3"]["lv"]
            };
         }
         else
         {
            ResearchModel.gi().DenShedLevel = {
               "den":_loc2_["2"]["lv"],
               "shed":0
            };
         }
         if(ResearchModel.gi().isOpenFirstUpdateTip())
         {
            ViewControl.getInstance().dispatchEvent(new Event("openFirstUpdateTip"));
         }
      }
      
      private function flyFn(param1:Object) : void
      {
         var _loc4_:String = null;
         if(param1.hasOwnProperty("errorType"))
         {
            _loc4_ = param1["errorType"];
            if(_loc4_ == "-2005")
            {
               FarmData.maxFly = true;
               FarmData.leftFly = 0;
               FarmData.maxErrInfo = param1["errorContent"];
            }
         }
         if(this.checkErrorReturn2(param1,"fly"))
         {
            return;
         }
         var _loc2_:Object = MData.getInstance().farmData.flyData;
         _loc2_["num"] = param1["total"];
         _loc2_["mynum"] += param1["num"];
         var _loc3_:Number = Math.floor(_loc2_["num"] / 2);
         _loc2_["flyNum1"] = _loc3_;
         _loc2_["flyNum2"] = _loc2_["num"] - _loc3_;
         FarmData.leftFly = param1["leftnum"];
         this._flyData = _loc2_;
      }
      
      private function useToolsFn(param1:Object) : void
      {
         var _loc2_:Array = null;
         var _loc3_:Object = null;
         if(param1["ecode"] == 0)
         {
            if(param1.hasOwnProperty("errorContent") && param1.hasOwnProperty("sfeedleft"))
            {
               if(param1["sfeedleft"] == 0)
               {
                  FarmData.sFeedTotalError = param1["errorContent"];
                  ViewControl.getInstance().dispatchEvent(new Event("checkanimal"));
               }
            }
            this.mainData = MData.getInstance().mainData;
            _loc2_ = this.mainData.animalData;
            if(param1.hasOwnProperty("serial"))
            {
               if(this.checkErrorReturn2(param1,"animal",null,param1["serial"]))
               {
                  return;
               }
            }
            else if(this.checkErrorReturn2(param1,"animal",null,this._feedAnimalIndex))
            {
               return;
            }
            if(param1.hasOwnProperty("animal"))
            {
               _loc2_[param1["animal"]["serial"]] = param1["animal"];
               this.mainData.nextStatusAnimal = param1["animal"];
            }
            FarmData.feedAnimalSerial = param1["serial"];
            ViewControl.getInstance().dispatchEvent(new Event("sFeed"));
            _loc3_ = this.getSeed(param1["post_data"]["tid"],"4");
            --_loc3_["amount"];
            if(_loc3_["amount"] <= 0)
            {
               Cursor.setCursor("CursorArrow");
               this.farmData.reloadUserSeed = true;
            }
         }
         else
         {
            Command.getInstance().mainCommand.floatWindow(param1["direction"]);
         }
      }
      
      private function addFoodDelay(param1:Number) : void
      {
         this.mainData.host["animalFood"] = param1;
         this.farmData.animalFood = param1;
      }
      
      public function addFood(param1:int, param2:Number = 0) : void
      {
         var _loc5_:Object = null;
         var _loc3_:String = this.mainData.currentUserId;
         var _loc4_:String = this.mainData.host["userName"];
         if(this.mainData.me)
         {
            _loc5_ = {
               "foodnum":param1,
               "type":param2
            };
         }
         else
         {
            _loc5_ = {
               "foodnum":param1,
               "uId":_loc3_,
               "nick":_loc4_,
               "type":param2
            };
         }
         this.fr.postRequest("cgi_feed_food",_loc5_,this.foodFn);
      }
      
      private function stealComplete(param1:TimerEvent = null) : void
      {
         ViewControl.getInstance().dispatchEvent(new Event("check_do"));
         Command.getInstance().mainCommand.checkStatus();
      }
      
      private function theftFn(param1:Object) : void
      {
         var _loc2_:String = param1["errorType"];
         if(Boolean(_loc2_) && (_loc2_ == "IOError" || _loc2_ == "httpStatus" || _loc2_ == "timeOut" || param1["errorType"] == "system"))
         {
            RequestManager.getInstance().addAction(RequestManager.STEAL);
         }
         if(this.checkErrorReturn2(param1,"product",EventRecorder.MC_STEAL_PRODUCT))
         {
            return;
         }
         this._theftReturn = param1["post_data"];
         EventRecorder.recordSueecssEvent(EventRecorder.MC_STEAL_PRODUCT,getTimer() - this.requestStartTime);
         RequestManager.getInstance().resetAction(RequestManager.STEAL);
         this.harvestList = param1 as Array;
         this.onAllStealTimer();
         if(!this.loopTimer)
         {
            this.loopTimer = new Timer(this.looptime);
         }
         this.loopTimer.addEventListener(TimerEvent.TIMER,this.onAllStealTimer);
         this.loopTimer.reset();
         this.loopTimer.start();
         this.mainData.reloadUserCrop = true;
         Command.getInstance().mainCommand.taskComp("touqie");
      }
      
      private function onAllStealTimer(param1:TimerEvent = null) : void
      {
         var itemData:Object = null;
         var i:String = null;
         var gift:Object = null;
         var giftWindow:REGiftWindow = null;
         var data:Object = null;
         var e:TimerEvent = param1;
         if(this.harvestList.length > 0)
         {
            itemData = this.harvestList.shift();
         }
         else
         {
            this._theftReturn = null;
            this.loopTimer.removeEventListener(TimerEvent.TIMER,this.onAllStealTimer);
            this.stealComplete();
         }
         if(!itemData)
         {
            return;
         }
         if(!this._theftReturn)
         {
            return;
         }
         if(Number(itemData[0]) <= 0)
         {
            Command.getInstance().mainCommand.floatWindow(itemData[1],"hunter");
            this.addMoney({"money":itemData[0]});
            try
            {
               if(this._theftReturn["type"] != -1)
               {
                  this.productData.addCando(this._theftReturn["type"],2);
               }
               else
               {
                  for(i in this.productData.products)
                  {
                     this.productData.addCando(i,2);
                  }
               }
            }
            catch(e:Error)
            {
               return;
            }
         }
         else if(Boolean(itemData.length > 0) && Boolean(itemData[0].hasOwnProperty("eNum")) && itemData[0]["eNum"] > 0)
         {
            gift = new Object();
            gift["direction"] = "恭喜您获得：<font color = \'#ff0000\'>1张" + GetCropID.idToCardName(itemData[0]["eParam"]) + "</font>！";
            gift["item"] = itemData[0];
            gift["tipsText"] = "小贴士：请在牧场“仓库—材料”中查看活动卡片，活动期间卡片可用于兑换礼包，或在加工坊进行加工。";
            giftWindow = new REGiftWindow();
            giftWindow.giftData = gift;
            WControl.open(giftWindow);
            this.mainData.reloadUserMaterial = true;
         }
         else
         {
            data = {
               "cId":itemData[0],
               "harvestnum":itemData[1]
            };
            try
            {
               this.farmData.harvestData = data;
               this.productData.addCando(String(data["cId"]),2);
               this.productData.addProduct(String(data["cId"]),data["harvestnum"] * -1);
            }
            catch(e:Error)
            {
            }
         }
      }
      
      private function currentUserChange(param1:Event) : void
      {
         clearTimeout(this.addFoodTimeoutId);
         if(this.loopTimer)
         {
            this.loopTimer.removeEventListener(TimerEvent.TIMER,this.onAllStealTimer);
            this.loopTimer.removeEventListener(TimerEvent.TIMER,this.onAllShouHuoTimer);
            this.loopTimer.stop();
         }
      }
      
      public function killFly(param1:Number, param2:Number = 1) : void
      {
         this.requestStartTime = getTimer();
         var _loc3_:Object = {
            "uId":this.mainData.currentUserId,
            "num":param2,
            "type":1,
            "pos":param1
         };
         this.fr.postRequest("cgi_help_pasture",_loc3_,this.killFn);
      }
      
      private function checkErrorReturn(param1:Object, param2:String = null) : Boolean
      {
         var _loc3_:String = null;
         if(param1.hasOwnProperty("errorType"))
         {
            _loc3_ = param1["errorType"];
            if(_loc3_ == "validateCode")
            {
               return true;
            }
            if(_loc3_ == "IOError" || _loc3_ == "httpStatus" || _loc3_ == "timeOut")
            {
               if(param2)
               {
                  EventRecorder.recordErrorEvent(param2,getTimer() - this.requestStartTime,EventRecorder.FAULT_ERROR);
               }
               this.alertWindow("error","请求超时，稍后再试");
               return true;
            }
            if(_loc3_ != "session" && param1.hasOwnProperty("errorContent") && StringUtil.trim(param1["errorContent"]) != "")
            {
               this.alertWindow("error",param1["errorContent"]);
               return true;
            }
            return true;
         }
         return false;
      }
      
      public function ShengChan(param1:int) : void
      {
         var _loc3_:String = null;
         var _loc4_:String = null;
         var _loc5_:Object = null;
         var _loc2_:Object = this.mainData.animalData[param1];
         if(_loc2_["status"] != FarmData.ANIMAL_DAICHAN)
         {
            if(this.mainData.me)
            {
               this.farmData.farmOperate = {
                  "text":"不是生产期或收获期，不能操作罐头可加速生长",
                  "type":"animal",
                  "serial":param1
               };
            }
            else
            {
               this.farmData.farmOperate = {
                  "text":"不是生产期,不能操作",
                  "type":"animal",
                  "serial":param1
               };
            }
         }
         else
         {
            _loc3_ = this.mainData.currentUserId;
            _loc4_ = this.mainData.host["userName"];
            if(this.mainData.me)
            {
               _loc5_ = {"serial":_loc2_.serial};
            }
            else
            {
               _loc5_ = {
                  "serial":_loc2_.serial,
                  "uId":_loc3_,
                  "nick":_loc4_
               };
            }
            this.requestStartTime = getTimer();
            this.fr.postRequest("cgi_post_product",_loc5_,this.shengchanFn);
         }
      }
      
      public function addExp(param1:Object) : void
      {
         if(param1.hasOwnProperty("addExp") && param1["addExp"] != 0)
         {
            if(param1["addExp"] <= 0)
            {
               return;
            }
            this.mainData.host["exp"] = int(this.mainData.host["exp"]) + int(param1["addExp"]);
            this.mainData.addExp = param1["addExp"];
         }
      }
      
      private function getUserSeedFn(param1:Object) : void
      {
         var _loc4_:String = null;
         if(param1.hasOwnProperty("errorType"))
         {
            _loc4_ = param1["errorType"];
            if(_loc4_ == "IOError" || _loc4_ == "httpStatus" || _loc4_ == "timeOut")
            {
               this.farmData.userSeedErr = "请求超时，请重试。";
            }
            EventRecorder.recordErrorEvent(EventRecorder.MC_REPERTORY_PCAKAGE,getTimer() - this.requestStartTime,EventRecorder.FAULT_ERROR);
            return;
         }
         EventRecorder.recordSueecssEvent(EventRecorder.MC_REPERTORY_PCAKAGE,getTimer() - this.requestStartTime);
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
         this.farmData.userSeedLoading = false;
         this.farmData.reloadUserSeed = false;
      }
      
      private function foodFn(param1:Object) : void
      {
         if(this.checkErrorReturn(param1))
         {
            return;
         }
         var _loc2_:Boolean = false;
         if(this.mainData.me)
         {
            _loc2_ = Command.getInstance().mainCommand.taskComp("mucao1");
         }
         else
         {
            _loc2_ = Command.getInstance().mainCommand.taskComp("mucao2");
         }
         ViewControl.getInstance().dispatchEvent(new Event("addFoodOk"));
         if(!_loc2_)
         {
            if(param1.hasOwnProperty("direction") && param1["type"] != 1)
            {
               this.farmData.farmOperate = {
                  "text":param1["direction"],
                  "type":"food"
               };
            }
            if(param1.hasOwnProperty("alert") || param1["type"] == 1)
            {
               Command.getInstance().mainCommand.floatWindow(param1["alert"] || param1["direction"]);
            }
         }
         if(param1["type"] == 1)
         {
            this.mainData.host["animalFood"] = param1.total;
            param1["money"] = -param1["money"];
            this.addMoney(param1);
            if(this.mainData.me)
            {
               this.addFoodTimeoutId = setTimeout(this.addFoodDelay,3000,param1.total);
               this.mainData.animalData = param1.animal;
            }
         }
         if(param1["type"] == 0)
         {
            if(param1["addExp"] == -1)
            {
               if(!FarmData.totalExp && !this.mainData.me)
               {
                  this.farmData.farmOperate = {
                     "text":"每天帮忙最多增加300点经验，您已加满",
                     "type":"food"
                  };
                  FarmData.totalExp = true;
               }
            }
            this.farmData.animalPackFood.amount -= param1.added;
            this.farmData.reloadUserSeed = true;
            this.mainData.animalData = param1.animal;
            this.addExp(param1);
            this.addFoodTimeoutId = setTimeout(this.addFoodDelay,3000,param1.total);
         }
         if(param1["type"] == 2)
         {
            if(param1["addExp"] == -1)
            {
               if(!FarmData.totalExp && !this.mainData.me)
               {
                  this.farmData.farmOperate = {
                     "text":"每天帮忙最多增加300点经验，您已加满",
                     "type":"food"
                  };
                  FarmData.totalExp = true;
               }
            }
            param1["money"] = -param1["money"];
            this.mainData.animalData = param1.animal;
            this.addExp(param1);
            this.addMoney(param1);
            this.addFoodTimeoutId = setTimeout(this.addFoodDelay,3000,param1.total);
         }
      }
      
      public function clearBB(param1:Number, param2:Number = 1) : void
      {
         this.requestStartTime = getTimer();
         var _loc3_:Object = {
            "uId":this.mainData.currentUserId,
            "num":param2,
            "type":2,
            "pos":param1
         };
         this.fr.postRequest("cgi_help_pasture",_loc3_,this.clearBBFn);
      }
      
      public function getUserSeed(param1:Boolean = false) : void
      {
         var _loc2_:Boolean = this.farmData.reloadUserSeed;
         if(MData.getInstance().farmData.userSeed == null || param1 || _loc2_)
         {
            this.requestStartTime = getTimer();
            this.fr.postRequest2("cgi_get_package",null,this.getUserSeedFn);
            this.farmData.userSeedLoading = true;
         }
         else
         {
            this.farmData.userSeed = MData.getInstance().farmData.userSeed;
         }
      }
      
      private function killFn(param1:Object) : void
      {
         var _loc2_:SpringFirecraker2012GetGift = null;
         if(param1.hasOwnProperty("ecode"))
         {
            if(param1["ecode"] != 0)
            {
               Command.getInstance().mainCommand.floatWindow(param1["direction"],"Exclamation");
               return;
            }
         }
         if(this.checkErrorReturn2(param1,"fly",EventRecorder.MC_CLEAR_FLY))
         {
            if(param1["errorContent"] == "您下手太慢，蚊子已经被拍了")
            {
               this.farmData.killFly(1,4);
               this.farmData.killFly(2,4);
               Command.getInstance().mainCommand.checkStatus();
               return;
            }
            ViewControl.getInstance().dispatchEvent(new Event("killInsectError"));
            return;
         }
         EventRecorder.recordSueecssEvent(EventRecorder.MC_CLEAR_FLY,getTimer() - this.requestStartTime);
         this.farmData.killFly(param1["pos"],param1["num"]);
         this.farmData.insectExp = param1;
         this.addExp(param1);
         Command.getInstance().mainCommand.checkStatus();
         if(param1.hasOwnProperty("item"))
         {
            _loc2_ = new SpringFirecraker2012GetGift(param1["item"]);
            WControl.open(_loc2_);
         }
         if(param1["addExp"] == 0)
         {
            if(!FarmData.totalExp)
            {
               this.farmData.farmOperate = {
                  "text":"每天帮忙最多增加300点经验，您已加满",
                  "type":"fly"
               };
               FarmData.totalExp = true;
            }
         }
      }
      
      private function addMoney(param1:Object) : void
      {
         if(param1.hasOwnProperty("money") && param1["money"] != 0)
         {
            this.mainData.host["money"] = int(this.mainData.host["money"]) + int(param1["money"]);
            this.mainData.addMoney = param1["money"];
         }
      }
      
      public function Theft(param1:int, param2:Boolean = false) : void
      {
         var nick:String;
         var uId:String;
         var postValue:Object;
         var animals:Array = null;
         var j:int = 0;
         var productData:ProductData = null;
         var is403:String = null;
         var value:int = param1;
         var all:Boolean = param2;
         if(!all)
         {
            this.mainData = MData.getInstance().mainData;
            animals = this.mainData.animalData;
            j = 0;
            while(j < animals.length)
            {
               if(Boolean(animals[j]) && Boolean(animals[j].status == FarmData.ANIMAL_SHENGCHAN) && animals[j].cId == value)
               {
                  this.farmData.farmOperate = {
                     "text":"动物生产中，请稍后收获！",
                     "type":"product"
                  };
                  return;
               }
               j++;
            }
            productData = MData.getInstance().productData;
            if(productData.products[value].cando == 2)
            {
               this.farmData.farmOperate = {
                  "text":"做人要厚道，你已经收取过了",
                  "type":"product"
               };
               return;
            }
            if(productData.products[value].cando == 1)
            {
               this.farmData.farmOperate = {
                  "text":"手下留情，给主人留一点吧",
                  "type":"product"
               };
               return;
            }
         }
         else
         {
            value = -1;
         }
         try
         {
            is403 = FeartureManager.stealMod();
            if(is403)
            {
               this.alertWindow("tip",is403);
               return;
            }
         }
         catch(e:Error)
         {
         }
         uId = this.mainData.currentUserId;
         nick = this.mainData.host["userName"];
         postValue = {
            "version":1,
            "uId":uId,
            "type":value,
            "nick":nick
         };
         this.fr.postRequest("cgi_steal_product",postValue,this.theftFn,RequestManager.STEAL);
         this.requestStartTime = getTimer();
      }
      
      private function onAllShouHuoTimer(param1:TimerEvent = null) : void
      {
         var data:Object = null;
         var animal1:Number = NaN;
         var animal2:Number = NaN;
         var hasTask:Boolean = false;
         var e:TimerEvent = param1;
         var hData:Object = this.harvestList[0];
         if(!hData)
         {
            return;
         }
         if(hData is Array && hData.length > 1)
         {
            data = {};
            data["cId"] = hData[0];
            data["harvestnum"] = hData[1];
            this.productData.addCando(String(data["cId"]),0);
            this.productData.addProduct(String(data["cId"]),data["harvestnum"] * -1,true);
            this.farmData.harvestData = data;
            Command.getInstance().mainCommand.taskComp("shouhuo");
         }
         else
         {
            try
            {
               data = {};
               data["cId"] = this.mainData.animalData[hData]["cId"];
               data["serial"] = Number(hData);
               animal1 = 0;
               animal2 = 0;
               if(GetCropID.getHouse(data["cId"]) == "窝")
               {
                  animal1++;
               }
               else
               {
                  animal2++;
               }
               this.mainData.host["animal1"] -= animal1;
               this.mainData.host["animal2"] -= animal2;
               this.mainData.animalShouHuoIndex = Number(data["serial"]);
               hasTask = false;
               hasTask = Command.getInstance().mainCommand.taskComp("shourou");
            }
            catch(e:Error)
            {
            }
            ViewControl.getInstance().dispatchEvent(new Event("animal_change"));
         }
         if(this.harvestList.length > 0)
         {
            this.harvestList.shift();
         }
         if(this.harvestList.length == 0)
         {
            if(this.loopTimer)
            {
               this.loopTimer.removeEventListener(TimerEvent.TIMER,this.onAllShouHuoTimer);
            }
         }
      }
      
      private function op(param1:Object) : void
      {
         this.farmData.farmOperate = {
            "text":"",
            "type":"clock",
            "serial":param1["animal"]["serial"],
            "t":param1["animal"]["growTimeNext"]
         };
      }
      
      private function shengchanFn(param1:Object) : void
      {
         var _loc2_:String = null;
         var _loc3_:Animal = null;
         var _loc4_:Array = null;
         if(!param1.hasOwnProperty("animal") && this.checkErrorReturn(param1,EventRecorder.MC_POST_PRODUCT))
         {
            return;
         }
         EventRecorder.recordSueecssEvent(EventRecorder.MC_POST_PRODUCT,getTimer() - this.requestStartTime);
         if(param1.hasOwnProperty("errorType") && param1.hasOwnProperty("animal"))
         {
            _loc2_ = param1["errorType"];
            if(param1.hasOwnProperty("errorContent") && StringUtil.trim(param1["errorContent"]) != "")
            {
               this.farmData.farmOperate = {
                  "text":param1["errorContent"],
                  "type":"animal",
                  "serial":param1["animal"]["serial"]
               };
            }
            _loc3_ = LocalData.shengShanAnimal as Animal;
            if(_loc3_.waitingShengChan)
            {
               _loc3_.mov();
            }
            if(param1["animal"])
            {
               this.mainData = MData.getInstance().mainData;
               _loc4_ = this.mainData.animalData;
               _loc4_[param1["serial"]] = param1["animal"];
               this.mainData.nextStatusAnimal = param1["animal"];
            }
         }
         if(!param1.hasOwnProperty("errorType"))
         {
            setTimeout(this.op,500,param1);
         }
         this.mainData.animalShengChanData = param1.animal;
         this.addExp(param1);
         if(this.mainData.me)
         {
            Command.getInstance().mainCommand.taskComp("shengchan1");
         }
         else
         {
            Command.getInstance().mainCommand.taskComp("shengchan2");
         }
         Command.getInstance().mainCommand.checkStatus();
         AnimalManager.getInstance().checkDo();
      }
      
      public function ShouHuo(param1:int, param2:int, param3:Boolean = false) : void
      {
         var _loc5_:Object = null;
         var _loc6_:Array = null;
         var _loc7_:int = 0;
         var _loc8_:int = 0;
         var _loc9_:Boolean = false;
         var _loc4_:int = 0;
         if(param2 == 1)
         {
            if(!param3)
            {
               this.mainData = MData.getInstance().mainData;
               _loc6_ = this.mainData.animalData;
               _loc4_ = 0;
               while(_loc4_ < _loc6_.length)
               {
                  if(Boolean(_loc6_[_loc4_]) && Boolean(_loc6_[_loc4_].status == FarmData.ANIMAL_SHENGCHAN) && _loc6_[_loc4_].cId == param1)
                  {
                     this.farmData.farmOperate = {
                        "text":"动物生产中，请稍后收获！",
                        "type":"product"
                     };
                     return;
                  }
                  _loc4_++;
               }
            }
            else
            {
               param1 = -1;
            }
            this.requestStartTime = getTimer();
            _loc5_ = {
               "version":1,
               "type":param1,
               "harvesttype":param2
            };
            this.fr.postRequest("cgi_harvest_product",_loc5_,this.shouhuoAllFn);
         }
         if(param2 == 2)
         {
            this.requestStartTime = getTimer();
            _loc7_ = _loc8_ = int(this.mainData.animalData[param1]["serial"]);
            if(param3)
            {
               _loc9_ = false;
               _loc6_ = this.mainData.animalData;
               _loc4_ = 0;
               while(_loc4_ < _loc6_.length)
               {
                  if(Boolean(_loc6_[_loc4_]) && _loc6_[_loc4_].status == FarmData.ANIMAL_SHOUHUO)
                  {
                     _loc9_ = true;
                     break;
                  }
                  _loc4_++;
               }
               if(!_loc9_)
               {
                  this.farmData.farmOperate = {
                     "text":"当前没有可以收获的动物哦！",
                     "type":"animal",
                     "serial":_loc7_
                  };
                  return;
               }
               _loc8_ = -1;
            }
            _loc5_ = {
               "version":1,
               "serial":_loc8_,
               "harvesttype":param2,
               "serialIndex":_loc7_
            };
            this.fr.postRequest("cgi_harvest_product",_loc5_,this.shouhuoAllFn);
         }
      }
      
      private function shouhuoAllFn(param1:Object) : void
      {
         var _loc2_:Array = null;
         var _loc3_:Object = null;
         var _loc4_:Object = null;
         var _loc5_:REGiftWindow = null;
         if(param1 is Array ? Boolean(1) : (param1.hasOwnProperty("ecode") ? param1["ecode"] == 0 : Boolean(0)))
         {
            if(param1["post_data"]["harvesttype"] == 2)
            {
               if(this.checkErrorReturn2(param1,"animal",null,param1["post_data"]["serialIndex"]))
               {
                  return;
               }
            }
            else if(param1["post_data"]["harvesttype"] == 1)
            {
               if(this.checkErrorReturn2(param1,"product",EventRecorder.MC_HARVEST_PRODUCT))
               {
                  return;
               }
            }
            else if(this.checkErrorReturn(param1))
            {
               return;
            }
            this.isShouhuo = true;
            if(param1["post_data"]["harvesttype"] == 1)
            {
               EventRecorder.recordSueecssEvent(EventRecorder.MC_HARVEST_PRODUCT,getTimer() - this.requestStartTime);
            }
            _loc2_ = param1[1].concat(param1[2]);
            if(this.harvestList)
            {
               this.harvestList = _loc2_.concat(this.harvestList);
            }
            else
            {
               this.harvestList = _loc2_;
            }
            if(param1.length > 3)
            {
               _loc3_ = param1[3];
               if(_loc3_.length > 0)
               {
                  _loc4_ = new Object();
                  _loc4_["direction"] = "恭喜您获得：<font color = \'#ff0000\'>1张" + (GetCropID.idToCardName(_loc3_[0]["eParam"]) || "活动卡片") + "</font>！";
                  _loc4_["item"] = _loc3_[0];
                  _loc4_["tipsText"] = "小贴士：请在牧场“仓库—材料”中查看活动卡片，活动期间卡片可用于兑换礼包，或在加工坊进行加工。";
                  _loc5_ = new REGiftWindow();
                  _loc5_.giftData = _loc4_;
                  WControl.open(_loc5_);
                  this.mainData.reloadUserMaterial = true;
               }
            }
            this.onAllShouHuoTimer();
            if(!this.loopTimer)
            {
               this.loopTimer = new Timer(this.looptime);
            }
            this.loopTimer.addEventListener(TimerEvent.TIMER,this.onAllShouHuoTimer);
            this.loopTimer.start();
            param1["addExp"] = param1[0];
            this.addExp(param1);
            this.mainData.reloadUserCrop = true;
            AnimalManager.getInstance().checkDo();
         }
         else if(param1.hasOwnProperty("direction"))
         {
            Command.getInstance().mainCommand.floatWindow(param1["direction"]);
         }
         else if(param1.hasOwnProperty("errorContent"))
         {
            Command.getInstance().mainCommand.floatWindow(param1["errorContent"]);
         }
         else
         {
            Command.getInstance().mainCommand.floatWindow("操作失败。");
         }
      }
      
      private function updateFly(param1:Event) : void
      {
         if(this._flyData)
         {
            this.farmData.flyData = this._flyData;
            this._flyData = null;
         }
      }
      
      private function alertWindow(param1:String, param2:String) : void
      {
         var _loc3_:WindowEvent = null;
         if(StringUtil.trim(param2) != "")
         {
            _loc3_ = new WindowEvent(WindowEvent.OPEN);
            _loc3_.windowName = "AlertWindow";
            _loc3_.windowArgument = {
               "type":param1,
               "text":param2
            };
            ViewControl.getInstance().dispatchEvent(_loc3_);
         }
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
      
      public function reclaim(param1:Object) : void
      {
         this.fr.postRequest("cgi_up_animalhouse",param1,this.reclaimFn);
      }
      
      private function clearBBFn(param1:Object) : void
      {
         if(this.checkErrorReturn2(param1,"bb",EventRecorder.MC_CLEAR_BB))
         {
            if(param1["errorContent"] == "您下手太慢，便便已经被清理了")
            {
               this.farmData.bbData["num"] = 0;
               ViewControl.getInstance().dispatchEvent(new Event("clearAllBB"));
               Command.getInstance().mainCommand.checkStatus();
               return;
            }
            ViewControl.getInstance().dispatchEvent(new Event("clearBBError"));
            return;
         }
         EventRecorder.recordSueecssEvent(EventRecorder.MC_CLEAR_BB,getTimer() - this.requestStartTime);
         if(param1["repNum"] == 0 && !FarmData.totalBB)
         {
            this.farmData.farmOperate = {
               "text":"每天最多清理100坨便便，您已满，不再入库",
               "type":"bb"
            };
            FarmData.totalBB = true;
         }
         this.farmData.clearBBPos = param1["pos"];
         this.addExp(param1);
         --this.farmData.bbData["num"];
         this.mainData.reloadUserCrop = true;
         Command.getInstance().mainCommand.checkStatus();
      }
      
      private function requestNum(param1:String, param2:int) : Boolean
      {
         if(!this.requestTime.hasOwnProperty(param1))
         {
            this.requestTime["type"] = {
               "num":0,
               "time":getTimer()
            };
         }
         if(param2 > 0 && this.requestTime["type"]["num"] > 5)
         {
            if(getTimer() - this.requestTime["type"]["time"] < 10000)
            {
               this.requestTime["type"]["time"] = getTimer();
               return false;
            }
            this.requestTime["type"]["num"] = 0;
         }
         this.requestTime["type"]["num"] += param2;
         this.requestTime["type"]["time"] = getTimer();
         return true;
      }
      
      public function reclaimPay(param1:Object, param2:Function) : void
      {
         this.fr.postRequest2("cgi_up_animalhouse",param1,param2);
      }
   }
}
