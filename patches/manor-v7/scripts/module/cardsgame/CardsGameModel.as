package module.cardsgame
{
   import §_-3i§.§_-Ep§;
   import §_-Iw§.§_-Yj§;
   import common.Session;
   import common.Settings;
   import flash.events.EventDispatcher;
   import framework.net.NetHelper;
   import framework.net.§_-99§;
   import framework.net.vo.ServiceResultVOHelper;
   
   public class CardsGameModel extends EventDispatcher
   {
      
      public static const §_-Jd§:String = "CardsGameRewardLoaded";
      
      public static const §_-5H§:String = "CardsGameRefreshed";
      
      public static const §_-0B§:String = "CardsGameBonus";
      
      private static const §_-1p§:int = 1;
      
      private var §_-FG§:int = 0;
      
      public function CardsGameModel()
      {
         super();
      }
      
      private function onBonus(param1:§_-Ep§) : void
      {
         var _loc3_:Object = null;
         var _loc4_:Array = null;
         var _loc5_:Object = null;
         var _loc2_:Object = ServiceResultVOHelper.getVOData(param1);
         this.dispatchEvent(new §_-Yj§(§_-0B§,_loc2_));
         if(int(_loc2_["code"]) == §_-1p§)
         {
            _loc3_ = Settings.getInstance().getCardsGameReward(_loc2_["id"]);
            _loc4_ = new Array();
            _loc5_ = new Object();
            _loc5_["eType"] = _loc3_["type"];
            _loc5_["eParam"] = _loc3_["cId"];
            _loc5_["eNum"] = parseInt(_loc3_["num"]);
            _loc4_.push(_loc5_);
            Session.getInstance().§_-WD§(_loc4_);
         }
      }
      
      public function refreshCardsGameData() : void
      {
         NetHelper.sendRequest(§_-99§.CMD_REFRESH_CARDSGAME_DATA,null,this.onRefresh,this.onRefresh);
      }
      
      public function getReward() : void
      {
         var _loc1_:* = {};
         _loc1_["flag"] = 2;
         _loc1_["pid"] = this.§_-FG§.toString();
         _loc1_["yellow"] = Session.getInstance().host._yellowstatus == 0 ? 0 : 1;
         NetHelper.sendRequest(§_-99§.§_-0q§,_loc1_,this.onReward,this.onReward);
      }
      
      public function getBonusGift() : void
      {
         var _loc1_:* = {};
         _loc1_["flag"] = 1;
         _loc1_["days"] = Session.getInstance().loginDays;
         NetHelper.sendRequest(§_-99§.§_-0q§,_loc1_,this.onBonus,this.onBonus);
      }
      
      private function onRefresh(param1:§_-Ep§) : void
      {
         var _loc2_:Object = ServiceResultVOHelper.getVOData(param1);
         this.dispatchEvent(new §_-Yj§(§_-5H§,_loc2_));
      }
      
      private function onReward(param1:§_-Ep§) : void
      {
         var _loc3_:Object = null;
         var _loc4_:Array = null;
         var _loc5_:Object = null;
         var _loc2_:Object = ServiceResultVOHelper.getVOData(param1);
         this.§_-FG§ = _loc2_["id"];
         Session.getInstance().remainPlays = int(_loc2_["canNum"]);
         this.dispatchEvent(new §_-Yj§(§_-Jd§,_loc2_));
         if(int(_loc2_["code"]) == §_-1p§)
         {
            _loc3_ = Settings.getInstance().getCardsGameReward(_loc2_["id"]);
            _loc4_ = new Array();
            _loc5_ = new Object();
            _loc5_["eType"] = _loc3_["type"];
            _loc5_["eParam"] = _loc3_["cId"];
            _loc5_["eNum"] = parseInt(_loc3_["num"]);
            _loc4_.push(_loc5_);
            Session.getInstance().§_-WD§(_loc4_);
         }
      }
   }
}
