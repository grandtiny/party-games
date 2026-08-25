package common.view.window
{
   import §_-0H§.Player;
   import §_-JM§.§_-3§;
   import §_-Oq§.§_-Bn§;
   import §_-Oq§.§_-De§;
   import §_-R0§.§_-7S§;
   import com.qzone.qui.controls.Button;
   import common.Session;
   import common.Settings;
   import common.§_-4Y§;
   import common.§_-Ac§;
   import common.misc.QzoneJSAPI;
   import common.misc.Utils;
   import flash.display.Bitmap;
   import flash.display.BitmapData;
   import flash.display.SimpleButton;
   import flash.display.Sprite;
   import flash.events.MouseEvent;
   import flash.external.ExternalInterface;
   import flash.text.TextField;
   import flash.text.TextFormat;
   import module.FarmApplication;
   
   public class GiftWindow extends §_-KR§
   {
      
      private var §_-JI§:Array;
      
      private var _confirmHandler:Function;
      
      private var directionTextField:TextField;
      
      private var §_-Cw§:Object;
      
      private var vipIconSprite:Sprite;
      
      private var §_-8M§:SimpleButton;
      
      private var §_-NG§:Array;
      
      private var confirmButton:Button;
      
      private var _tip:String;
      
      private var rewardGrid:Sprite;
      
      private var vipTextField:TextField;
      
      private var §_-8b§:Boolean;
      
      private var txt:TextField;
      
      public function GiftWindow(param1:§_-3§)
      {
         super(param1);
         width = 440;
         height = 320;
         mode = true;
         title = §_-4Y§.§_-Kf§["礼包"];
         windowName = §_-Ac§.§_-LP§;
         this._confirmHandler = null;
         this.§_-Cw§ = null;
      }
      
      public function set vipText(param1:String) : void
      {
         if(this.vipTextField != null)
         {
            this.vipTextField.htmlText = "<font size=\"12\">" + param1 + "</font>";
         }
      }
      
      public function set giftItemList(param1:Array) : void
      {
         this.§_-JI§ = param1;
         this.renderRewardGrid();
      }
      
      override public function onEffectEnd() : void
      {
         super.onEffectEnd();
      }
      
      private function setYellowInfo(param1:String) : void
      {
         §_-Bn§.removeChild(this,this.§_-8M§);
         §_-Bn§.removeChild(this,this.vipIconSprite);
         if(parseInt(param1) > 0 && parseInt(param1) <= 7)
         {
            addChild(this.vipIconSprite);
         }
         else
         {
            §_-Bn§.removeChild(this,this.§_-8M§);
            §_-Bn§.removeChild(this,this.vipIconSprite);
         }
         this.setSize();
      }
      
      private function §_-Y2§(param1:String) : void
      {
         var _loc3_:String = null;
         if(this.txt)
         {
            §_-Bn§.removeChild(this,this.txt);
            this.txt.removeEventListener(MouseEvent.ROLL_OVER,this.tipTxtRollOver);
            this.txt.removeEventListener(MouseEvent.ROLL_OUT,this.tipTxtRollOut);
         }
         this.txt = new TextField();
         this.txt.selectable = false;
         this.txt.width = 100;
         this.txt.height = 100;
         this.txt.addEventListener(MouseEvent.ROLL_OVER,this.tipTxtRollOver);
         this.txt.addEventListener(MouseEvent.ROLL_OUT,this.tipTxtRollOut);
         addChild(this.txt);
         this._tip = "作物类型：@harvestTimes季作物<br/>成熟时间：<font color=\'#339933\'> <b>@growTime</b> </font>小时<br/>预计产量：<font color=\'#339933\'> <b>@output</b> </font>个<br/>果实售价：金币<font color=\'#FF6600\'> <b>@sale</b> </font><br/>预计收入：金币<font color=\'#FF6600\'> <b>@outputMoney</b> </font><br/>收获经验：<font color=\'#FF6600\'> <b>@exp</b> </font>/季<br/>种植等级：<font color=\'#339933\'> <b>@level</b> </font> 级";
         var _loc2_:Object = Settings.getInstance().getCardsGameReward(param1);
         if(_loc2_["growTime"] > 1000)
         {
            _loc2_["growTime"] = (parseInt(_loc2_["growTime"]) / 3600).toString();
         }
         for(_loc3_ in _loc2_)
         {
            this._tip = this._tip.replace("@" + _loc3_,_loc2_[_loc3_]);
         }
         this._tip = this._tip.replace(/@outputMoney/,_loc2_["harvestTimes"] * _loc2_["output"] * _loc2_["sale"]);
      }
      
      override protected function setSize() : void
      {
         var _loc1_:Object = super.data;
         var _loc2_:Boolean = _loc1_ != null && _loc1_.hasOwnProperty("big") && _loc1_["big"] == true;
         var _loc3_:int = (this.§_-JI§ == null ? 0 : this.§_-JI§.length) + (this.§_-NG§ == null ? 0 : this.§_-NG§.length);
         var _loc4_:int = Math.ceil(_loc3_ / 3);
         var _loc5_:Number = _loc2_ ? 140 : 95;
         this.directionTextField.y = 30;
         this.directionTextField.width = width - 40;
         this.directionTextField.x = 20;
         this.vipTextField.width = width - 40;
         this.vipTextField.x = 20;
         this.vipTextField.y = this.directionTextField.y + Math.max(18,this.directionTextField.textHeight) + 6;
         this.rewardGrid.x = 20;
         this.rewardGrid.y = this.vipTextField.y;
         if(this.vipTextField.text.length > 0)
         {
            this.rewardGrid.y += Math.max(16,this.vipTextField.textHeight) + 8;
         }
         height = Math.max(180,this.rewardGrid.y + _loc4_ * _loc5_ + 55);
         super.setSize();
         this.confirmButton.x = (width - this.confirmButton.width) / 2;
         this.confirmButton.y = height - 40;
         if(this.txt)
         {
            this.txt.x = §_-De§.middle(width,this.txt.width);
            this.txt.y = this.rewardGrid.y;
         }
         if(titleAlign == §_-7S§.CENTER)
         {
            panelTitle.x = §_-De§.middle(_width,panelTitle.width);
         }
         else
         {
            panelTitle.x = 4;
         }
      }
      
      private function tipTxtRollOut(param1:MouseEvent) : void
      {
      }
      
      override protected function init() : void
      {
         this.§_-8M§ = Utils.getMaterial("Renewal") as SimpleButton;
         this.§_-8M§.x = 299;
         this.§_-8M§.y = 27;
         this.vipIconSprite = new Sprite();
         var _loc1_:Class = Utils.getClass("VipIcon") as Class;
         var _loc2_:BitmapData = new _loc1_(13,10);
         this.vipIconSprite.addChild(new Bitmap(_loc2_));
         this.vipIconSprite.x = 14;
         this.vipIconSprite.y = 31;
         this.directionTextField = new TextField();
         this.directionTextField.selectable = false;
         var _loc3_:TextFormat = new TextFormat("Verdana",14,3355443);
         _loc3_.leading = 8;
         this.directionTextField.defaultTextFormat = _loc3_;
         this.directionTextField.width = 390;
         this.directionTextField.height = 90;
         this.directionTextField.wordWrap = true;
         this.directionTextField.multiline = true;
         this.directionTextField.x = §_-De§.middle(width,this.directionTextField.width);
         this.directionTextField.y = 30;
         addChild(this.directionTextField);
         this.rewardGrid = new Sprite();
         this.rewardGrid.mouseChildren = false;
         this.rewardGrid.mouseEnabled = false;
         addChild(this.rewardGrid);
         this.vipTextField = new TextField();
         this.vipTextField.selectable = false;
         this.vipTextField.y = 215;
         this.vipTextField.width = 390;
         this.vipTextField.height = 53;
         this.vipTextField.x = 20;
         var _loc4_:TextFormat = new TextFormat("Verdana",12,10027008);
         _loc4_.leading = 5;
         this.vipTextField.defaultTextFormat = _loc4_;
         this.vipTextField.wordWrap = true;
         this.vipTextField.multiline = true;
         addChild(this.vipTextField);
         this.confirmButton = new Button();
         this.confirmButton.defaultSkin = Utils.getClass("ButtonOrange");
         this.confirmButton.width = 65;
         this.confirmButton.height = 25;
         this.confirmButton.x = (width - this.confirmButton.width) / 2;
         this.confirmButton.y = height - 40;
         this.confirmButton.text = §_-4Y§.§_-Kf§["确定"];
         this.confirmButton.addEventListener(MouseEvent.CLICK,this.confirmButtonClick);
         addChild(this.confirmButton);
      }
      
      public function set confirmHandler(param1:Function) : void
      {
         this._confirmHandler = param1;
      }
      
      public function set directionText(param1:String) : void
      {
         if(this.directionTextField != null && param1 != null)
         {
            this.directionTextField.htmlText = param1;
         }
      }
      
      public function set vipGiftItemList(param1:Array) : void
      {
         this.§_-NG§ = param1;
         this.renderRewardGrid();
      }

      private function renderRewardGrid() : void
      {
         var _loc1_:Object = null;
         var _loc2_:Boolean = false;
         var _loc3_:Array = null;
         var _loc4_:Number = NaN;
         var _loc5_:Number = NaN;
         var _loc6_:Number = NaN;
         var _loc7_:int = 0;
         var _loc8_:GiftItem = null;
         if(this.rewardGrid == null)
         {
            return;
         }
         while(this.rewardGrid.numChildren > 0)
         {
            this.rewardGrid.removeChildAt(0);
         }
         _loc1_ = super.data;
         _loc2_ = _loc1_ != null && _loc1_.hasOwnProperty("big") && _loc1_["big"] == true;
         _loc3_ = [];
         if(this.§_-JI§ != null)
         {
            _loc3_ = _loc3_.concat(this.§_-JI§);
         }
         if(this.§_-NG§ != null)
         {
            _loc3_ = _loc3_.concat(this.§_-NG§);
         }
         _loc4_ = width - 40;
         _loc5_ = _loc4_ / 3;
         _loc6_ = _loc2_ ? 140 : 95;
         for(_loc7_ = 0; _loc7_ < _loc3_.length; _loc7_++)
         {
            _loc8_ = new GiftItem(_loc2_);
            _loc8_.data = _loc3_[_loc7_];
            _loc8_.x = _loc7_ % 3 * _loc5_ + (_loc5_ - (_loc2_ ? 120 : 108)) / 2;
            _loc8_.y = Math.floor(_loc7_ / 3) * _loc6_;
            this.rewardGrid.addChild(_loc8_);
         }
      }
      
      private function confirmButtonClick(param1:MouseEvent) : void
      {
         close();
         if(this._confirmHandler != null)
         {
            this._confirmHandler();
         }
         this._confirmHandler = null;
      }
      
      private function tipTxtRollOver(param1:MouseEvent) : void
      {
      }
      
      private function §_-TO§() : void
      {
         var _loc2_:Player = null;
         var _loc1_:Object = super.data;
         if(_loc1_ != null)
         {
            if(!(_loc1_.hasOwnProperty("everyDayGift") && _loc1_["everyDayGift"] == true))
            {
               §_-Bn§.removeChild(this,this.§_-8M§);
               §_-Bn§.removeChild(this,this.vipIconSprite);
            }
            else
            {
               §_-Bn§.removeChild(this,this.§_-8M§);
            }
            if(_loc1_.hasOwnProperty("cardsGameGift") && Boolean(_loc1_["cardsGameGift"]))
            {
               this.§_-Y2§(_loc1_["giftID"]);
            }
            else
            {
               §_-Bn§.removeChild(this,this.txt);
            }
            if(_loc1_.hasOwnProperty("big") == true && _loc1_["big"] == true)
            {
               this.vipTextField.width = 390;
               this.directionTextField.width = 390;
               width = 440;
               height = 320;
               if(this.directionTextField.numLines <= 2)
               {
                  this.directionTextField.y += 20;
               }
            }
            else
            {
               this.vipTextField.width = 340;
               this.directionTextField.width = 340;
               width = 385;
            }
         }
         this.renderRewardGrid();
         this.setSize();
      }
      
      override protected function setData() : void
      {
         this.graphics.clear();
         var _loc1_:Object = super.data;
         if(_loc1_ == null)
         {
            this.directionText = "";
            this.vipText = "";
            this.giftItemList = null;
            this.vipGiftItemList = null;
            this.confirmHandler = null;
            return;
         }
         var _loc2_:TextFormat = this.directionTextField.defaultTextFormat;
         if(_loc1_.hasOwnProperty("big") == true && _loc1_["big"] == true)
         {
            _loc2_.size = 12;
            this.directionTextField.defaultTextFormat = _loc2_;
         }
         else
         {
            _loc2_.size = 14;
            this.directionTextField.defaultTextFormat = _loc2_;
         }
         if(_loc1_["title"] != undefined && _loc1_["title"] != "")
         {
            super.title = _loc1_["title"];
         }
         this.directionText = _loc1_["direction"];
         if(_loc1_["levelup"] == true)
         {
            this.confirmButton.text = "领取";
         }
         if(_loc1_["item"] is Array)
         {
            this.giftItemList = _loc1_["item"];
         }
         else
         {
            this.giftItemList = null;
         }
         if(_loc1_.hasOwnProperty("vipText"))
         {
            this.vipText = _loc1_["vipText"];
         }
         else
         {
            this.vipText = "";
         }
         if(_loc1_.hasOwnProperty("vipItem") && _loc1_["vipItem"] != undefined && _loc1_["vipItem"] is Array)
         {
            this.vipGiftItemList = _loc1_["vipItem"];
         }
         else
         {
            this.vipGiftItemList = null;
         }
         if(_loc1_.hasOwnProperty("confirmHandler"))
         {
            this.confirmHandler = _loc1_["confirmHandler"] as Function;
         }
         else
         {
            this.confirmHandler = null;
         }
         this.§_-TO§();
      }
      
      private function onNavigateToURL(param1:MouseEvent) : void
      {
      }
   }
}

