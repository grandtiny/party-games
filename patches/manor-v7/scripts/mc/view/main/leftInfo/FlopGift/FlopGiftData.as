package mc.view.main.leftInfo.FlopGift
{
   import common.INI;
   import flash.events.EventDispatcher;
   import flash.utils.getTimer;
   import mc.FBridge.EventRecorder;
   import mc.FBridge.FRequest;
   import mc.control.Command;
   import mc.events.CommonEvent;
   import mc.model.MData;
   
   public class FlopGiftData extends EventDispatcher
   {
      
      private static var intence:FlopGiftData;
      
      public static const YELLOW_FLOP_NUM:int = 2;
      
      public static const SINGLE_FLOP_NUM:int = 1;
      
      private var _flopGetGift:int;
      
      public var _clickBox:int = 0;
      
      private var getLoginGift:Boolean;
      
      private var fr:FRequest;
      
      private var _flopDate:int;
      
      private var _flopGift:FlopGiftIcon;
      
      private var _flopBoo:Boolean;
      
      private var _lastRewardID:int = 0;
      
      public var canClickIcon:Boolean = true;
      
      private var _flopTime:int;
      
      private var clickTime:int;
      
      public var clickTimeData:Array;
      
      public function FlopGiftData()
      {
         super();
         this.fr = FRequest.getInstance();
         this.clickTimeData = new Array();
         this.getLoginGift = false;
      }
      
      public static function gi() : FlopGiftData
      {
         if(intence == null)
         {
            intence = new FlopGiftData();
         }
         return intence;
      }
      
      private function loginFlopData(param1:Object) : void
      {
         if(param1.hasOwnProperty("ecode"))
         {
            if(param1["ecode"] != 0)
            {
               Command.getInstance().mainCommand.floatWindow(param1["direction"]);
               return;
            }
         }
         this.getLoginGift = false;
         if(param1["bonus"] == 0)
         {
            this.getLoginGift = true;
         }
         var _loc2_:CommonEvent = new CommonEvent(FlopGiftControl.FLOPDATA);
         _loc2_.data = {"data":param1};
         dispatchEvent(_loc2_);
      }
      
      private function clickFlopItem(param1:Object) : void
      {
         if(param1.hasOwnProperty("ecode"))
         {
            if(param1["ecode"] != 0)
            {
               Command.getInstance().mainCommand.floatWindow(param1["direction"]);
               return;
            }
         }
         this._lastRewardID = param1["id"];
         this.invalidatePackage();
         var _loc2_:CommonEvent = new CommonEvent(FlopGiftControl.FLOP_ITEM_CLICK);
         _loc2_.data = {"data":param1};
         dispatchEvent(_loc2_);
      }
      
      public function set flopGetGift(param1:int) : void
      {
         this._flopGetGift = param1;
      }
      
      public function flopItemClick() : void
      {
         var _loc1_:* = {};
         _loc1_["flag"] = 2;
         _loc1_["pid"] = this._lastRewardID.toString();
         _loc1_["yellow"] = MData.getInstance().mainData.host["yellowstatus"] == 0 ? 0 : 1;
         this.fr.postRequest(INI.getInstance().getPostUrl() + "cgi_signin",_loc1_,this.clickFlopItem);
      }
      
      private function loginGiftHandler(param1:Object) : void
      {
         if(param1.hasOwnProperty("ecode"))
         {
            if(param1["ecode"] != 0)
            {
               Command.getInstance().mainCommand.floatWindow(param1["direction"]);
               return;
            }
         }
         this.invalidatePackage();
         var _loc2_:CommonEvent = new CommonEvent(FlopGiftControl.FLOP_CGI_GIFT);
         _loc2_.data = {"data":param1};
         dispatchEvent(_loc2_);
      }
      
      public function flopLoginGift(param1:int) : void
      {
         if(this.getLoginGift == true)
         {
            return;
         }
         this.getLoginGift = true;
         var _loc2_:* = {};
         _loc2_["flag"] = 1;
         _loc2_["days"] = param1.toString();
         this.fr.postRequest(INI.getInstance().getPostUrl() + "cgi_signin",_loc2_,this.loginGiftHandler);
      }

      private function invalidatePackage() : void
      {
         MData.getInstance().farmData.reloadUserSeed = true;
         MData.getInstance().mainData.reloadUserCrop = true;
      }
      
      public function get flopGetGift() : int
      {
         return this._flopGetGift;
      }
      
      private function clickFlopData(param1:Object) : void
      {
         if(param1.hasOwnProperty("ecode"))
         {
            if(param1["ecode"] != 0)
            {
               Command.getInstance().mainCommand.floatWindow(param1["direction"]);
               EventRecorder.recordErrorEvent(EventRecorder.FLOP_NC,getTimer() - getTimer(),EventRecorder.FAULT_ERROR);
               return;
            }
         }
         if(param1.hasOwnProperty("number") == false)
         {
            Command.getInstance().mainCommand.floatWindow("系统繁忙，请稍后再试！");
            return;
         }
         if(param1.hasOwnProperty("bonus") == false)
         {
            Command.getInstance().mainCommand.floatWindow("系统繁忙，请稍后再试！");
            return;
         }
         this.getLoginGift = false;
         if(param1["bonus"] == 0)
         {
            this.getLoginGift = true;
         }
         var _loc2_:CommonEvent = new CommonEvent(FlopGiftControl.FLOP_ICON_CLICK);
         _loc2_.data = {"data":param1};
         dispatchEvent(_loc2_);
         this.canClickIcon = true;
         EventRecorder.recordSueecssEvent(EventRecorder.FLOP_NC,getTimer() - getTimer());
      }
      
      public function get flopTime() : int
      {
         return this._flopTime;
      }
      
      public function getIsFlop() : void
      {
         this.fr.postRequest(INI.getInstance().getPostUrl() + "cgi_pasture_login_home",null,this.loginFlopData);
      }
      
      public function flopIconClick() : void
      {
         this.clickTime = getTimer();
         this.fr.postRequest(INI.getInstance().getPostUrl() + "cgi_pasture_login_click",null,this.clickFlopData);
      }
      
      public function set flopTime(param1:int) : void
      {
         this._flopTime = param1;
         var _loc2_:CommonEvent = new CommonEvent(FlopGiftControl.HAVEFLOPDATA);
         _loc2_.data = {"number":param1};
         dispatchEvent(_loc2_);
      }
      
      public function set flopDate(param1:int) : void
      {
         this._flopDate = param1;
         var _loc2_:CommonEvent = new CommonEvent(FlopGiftControl.FLOP_GET_DATE);
         _loc2_.data = {"number":param1};
         dispatchEvent(_loc2_);
      }
      
      public function get flopDate() : int
      {
         return this._flopDate == 0 ? 1 : this._flopDate;
      }
   }
}
