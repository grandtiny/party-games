package module.cardsgame
{
   import §_-0H§.Player;
   import §_-Iw§.§_-Yj§;
   import §_-JM§.§_-1R§;
   import §_-VB§.§_-2S§;
   import common.Session;
   import common.Settings;
   import common.§_-Ac§;
   import flash.utils.clearTimeout;
   import flash.utils.setTimeout;
   import framework.base.§_-Gy§;
   
   public class CardsGameController extends §_-Gy§
   {
      
      private static const §_-1p§:int = 1;
      
      public static const §_-Tg§:String = "removeCardsGameIcon";
      
      private var _timer:int = -1;

      private var cardsModel:CardsGameModel;
      
      public function CardsGameController(param1:§_-1R§)
      {
         super(param1);
         this.cardsModel = new CardsGameModel();
         this.model.addEventListener(§_-Ac§.§_-8t§,this.onGetGift);
         this.module.app.addEventListener(§_-Ac§.§_-BS§,this.refreshCardsGameData);
         this.module.app.addEventListener(§_-Tg§,this.removeIcon);
      }
      
      public function get model() : CardsGameModel
      {
         return this.cardsModel;
      }
      
      private function refreshCardsGameData(param1:§_-Yj§) : void
      {
         this.module.app.removeEventListener(§_-Ac§.§_-BS§,this.refreshCardsGameData);
         this.model.addEventListener(CardsGameModel.§_-5H§,this.openCardsGameWindow);
         this.model.refreshCardsGameData();
      }
      
      private function openCardsGameWindow2(param1:§_-Yj§) : void
      {
         var _loc4_:CardsGameWindow = null;
         var _loc5_:String = null;
         var _loc6_:String = null;
         var _loc7_:String = null;
         var _loc8_:String = null;
         var _loc9_:Object = null;
         var _loc10_:Object = null;
         if(Session.getInstance().remainPlays > 0)
         {
            _loc4_ = new CardsGameWindow(this);
            this.module.app.farmView.winCtrl.open(_loc4_);
         }
         var _loc2_:Object = param1.data;
         var _loc3_:int = int(_loc2_["code"]);
         if(_loc3_ == §_-1p§)
         {
            Session.getInstance().§_-8J§ = int(_loc2_["bonus"]);
            this.module.app.dispatchEvent(new §_-Yj§(§_-Ac§.§_-Md§,null));
            this.module.app.dispatchEvent(new §_-Yj§(§_-Ac§.§_-A§,null));
            _loc5_ = _loc2_["id"];
            _loc6_ = Settings.getInstance().getCardsGameReward(_loc5_)["name"];
            _loc7_ = Settings.getInstance().getCardsGameReward(_loc5_)["num"];
            _loc8_ = "您已连续登录" + Session.getInstance().loginDays.toString() + "天，农场村委会特向您赠送" + _loc6_ + _loc7_ + "个，以资鼓励!";
            _loc9_ = Settings.getInstance().getCardsGameReward(_loc5_);
            _loc10_ = {
               "item":[{
                  "eType":_loc9_["type"],
                  "eNum":_loc9_["num"],
                  "eParam":_loc9_["cId"]
               }],
               "title":"温馨提示",
               "direction":_loc8_,
               "cardsGameGift":true,
               "giftID":_loc5_,
               "confirmHandler":this.removeIcon
            };
            this.module.app.openWindowByName(§_-Ac§.§_-LP§,_loc10_);
         }
      }
      
      private function iconAddListener() : void
      {
         if(this._timer != -1)
         {
            clearTimeout(this._timer);
         }
         this.module.app.addEventListener(§_-Ac§.§_-BS§,this.refreshCardsGameData);
      }
      
      private function openCardsGameWindow(param1:§_-Yj§) : void
      {
         var _loc4_:Player = null;
         var _loc5_:CardsGameWindow = null;
         var _loc2_:Object = param1.data;
         var _loc3_:int = int(_loc2_["code"]);
         if(_loc3_ == §_-1p§)
         {
            Session.getInstance().loginDays = _loc2_["days"];
            _loc4_ = Session.getInstance().host;
            if(_loc4_._yellowstatus != 0)
            {
               Session.getInstance().remainPlays = 2 - int(_loc2_["number"]);
            }
            else
            {
               Session.getInstance().remainPlays = 1 - int(_loc2_["number"]);
            }
            if(int(_loc2_["bonus"]) > 0)
            {
               this.model.addEventListener(CardsGameModel.§_-0B§,this.openCardsGameWindow2);
               this.model.getBonusGift();
               this._timer = setTimeout(this.iconAddListener,500);
               return;
            }
            Session.getInstance().§_-8J§ = 0;
            if(Session.getInstance().remainPlays > 0)
            {
               _loc5_ = new CardsGameWindow(this);
               this.module.app.farmView.winCtrl.open(_loc5_);
               this._timer = setTimeout(this.iconAddListener,500);
            }
            else
            {
               this.removeIcon();
            }
         }
         else
         {
            this._timer = setTimeout(this.iconAddListener,500);
         }
      }
      
      public function removeIcon(param1:§_-Yj§ = null) : void
      {
         if(Session.getInstance().remainPlays <= 0 && Session.getInstance().§_-8J§ == 0)
         {
            this.module.app.dispatchEvent(new §_-Yj§(§_-2S§.GET_CARDSGAME_DATA,true));
         }
      }
      
      private function onGetGift(param1:§_-Yj§) : void
      {
         this.module.app.dispatchEvent(new §_-Yj§(§_-Ac§.§_-8t§,param1.data));
         this.module.app.dispatchEvent(new §_-Yj§(§_-Ac§.§_-A§,null));
      }
   }
}
