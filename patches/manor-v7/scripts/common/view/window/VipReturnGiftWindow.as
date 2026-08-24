package common.view.window
{
   import §_-JM§.§_-3§;
   import §_-N-§.§_-2Y§;
   import §_-Oq§.§_-De§;
   import §_-R0§.§_-7S§;
   import com.qzone.qui.containers.HBox;
   import com.qzone.qui.controls.Button;
   import common.Settings;
   import common.§_-4Y§;
   import common.§_-Ac§;
   import common.misc.Utils;
   import flash.display.SimpleButton;
   import flash.events.MouseEvent;
   import flash.events.TextEvent;
   import flash.external.ExternalInterface;
   import flash.text.TextField;
   import flash.text.TextFormat;
   
   public class VipReturnGiftWindow extends §_-KR§
   {
      
      private var §_-JI§:Array;
      
      private var _confirmHandler:Function;
      
      private var directionTextField:TextField;
      
      private var loader:§_-2Y§;
      
      private var confirmButton:Button;
      
      private var §_-NG§:Array;
      
      private var vipGiftList:HBox;
      
      private var vipRenewalButton:SimpleButton;
      
      private var giftList:HBox;
      
      private var vipTextField:TextField;
      
      private var §_-Cw§:Object;
      
      private var label:TextField;
      
      public function VipReturnGiftWindow(param1:§_-3§)
      {
         super(param1);
         width = 440;
         height = 320;
         mode = true;
         title = §_-4Y§.§_-Kf§["礼包"];
         windowName = §_-Ac§.§_-7Y§;
         this._confirmHandler = null;
         this.§_-Cw§ = null;
      }
      
      public function set giftItemList(param1:Array) : void
      {
         var _loc4_:GiftItem = null;
         var _loc5_:* = undefined;
         var _loc2_:Object = super.data;
         if(_loc2_ == null)
         {
            return;
         }
         var _loc3_:Boolean = false;
         if(_loc2_.hasOwnProperty("big") == true && _loc2_["big"] == true)
         {
            _loc3_ = true;
         }
         this.§_-JI§ = param1;
         if(this.giftList != null)
         {
            this.giftList.removeAllElements();
            this.giftList.height = _loc3_ ? 140 : 100;
            _loc4_ = null;
            for each(_loc5_ in param1)
            {
               _loc4_ = new GiftItem(_loc3_);
               _loc4_.data = _loc5_;
               this.giftList.addElement(_loc4_);
            }
         }
      }
      
      override protected function setSize() : void
      {
         super.setSize();
         this.directionTextField.y = 30;
         this.confirmButton.x = (width - this.confirmButton.width) / 2;
         this.giftList.x = §_-De§.middle(width,this.giftList.width);
         this.giftList.y = this.directionTextField.y + this.directionTextField.textHeight + 15;
         this.vipTextField.y = this.giftList.y + this.giftList.height + 15;
         if(this.vipGiftList.visible == true)
         {
            this.vipGiftList.x = §_-De§.middle(width,this.vipGiftList.width);
            this.vipGiftList.y = this.vipTextField.y + this.vipTextField.textHeight;
            height = this.vipGiftList.y + this.vipGiftList.height + 50;
         }
         else
         {
            height = this.vipTextField.y + this.vipTextField.textHeight + 70;
         }
         this.confirmButton.y = height - 40;
         if(titleAlign == §_-7S§.CENTER)
         {
            panelTitle.x = §_-De§.middle(_width,panelTitle.width);
         }
         else
         {
            panelTitle.x = 4;
         }
      }
      
      public function set vipGiftItemList(param1:Array) : void
      {
         var _loc4_:GiftItem = null;
         var _loc5_:* = undefined;
         this.§_-NG§ = param1;
         if(this.vipGiftList == null)
         {
            return;
         }
         var _loc2_:Object = super.data;
         if(_loc2_ == null)
         {
            return;
         }
         var _loc3_:Boolean = false;
         if(_loc2_.hasOwnProperty("big") == true && _loc2_["big"] == true)
         {
            _loc3_ = true;
         }
         if(param1 != null && param1.length > 0)
         {
            this.vipGiftList.removeAllElements();
            this.vipGiftList.height = _loc3_ ? 140 : 100;
            _loc4_ = null;
            for each(_loc5_ in param1)
            {
               _loc4_ = new GiftItem(_loc3_);
               _loc4_.data = _loc5_;
               this.vipGiftList.addElement(_loc4_);
            }
            this.vipGiftList.visible = true;
         }
         else
         {
            this.vipGiftList.removeAllElements();
            this.vipGiftList.visible = false;
         }
      }
      
      private function onNavigateToURL1(param1:TextEvent) : void
      {
      }
      
      override protected function init() : void
      {
         var _loc1_:TextFormat = new TextFormat("Verdana",13,12547910,null,null,null,null,null,"left",28,null,null,5);
         this.directionTextField = new TextField();
         this.directionTextField.selectable = false;
         var _loc2_:TextFormat = new TextFormat("Verdana",14,3355443);
         _loc2_.leading = 8;
         this.directionTextField.defaultTextFormat = _loc2_;
         this.directionTextField.width = 360;
         this.directionTextField.height = 190;
         this.directionTextField.wordWrap = true;
         this.directionTextField.multiline = true;
         this.directionTextField.x = §_-De§.middle(width,this.directionTextField.width);
         this.directionTextField.y = 30;
         addChild(this.directionTextField);
         this.giftList = new HBox(390,140);
         this.giftList.§_-4R§ = §_-7S§.CENTER;
         this.giftList.§_-Wd§ = §_-7S§.§_-8R§;
         this.giftList.mouseChildren = false;
         this.giftList.mouseEnabled = false;
         this.giftList.horizontalScrollPolicy = "off";
         this.giftList.verticalScrollPolicy = "off";
         this.giftList.defaultSkin = null;
         addChild(this.giftList);
         this.vipTextField = new TextField();
         this.vipTextField.selectable = false;
         this.vipTextField.y = 215;
         this.vipTextField.width = 390;
         this.vipTextField.height = 53;
         this.vipTextField.x = 20;
         var _loc3_:TextFormat = new TextFormat("Verdana",14,3355443);
         _loc3_.leading = 5;
         this.vipTextField.defaultTextFormat = _loc3_;
         this.vipTextField.wordWrap = true;
         this.vipTextField.multiline = true;
         addChild(this.vipTextField);
         this.vipGiftList = new HBox(390,140);
         this.vipGiftList.§_-4R§ = §_-7S§.CENTER;
         this.vipGiftList.§_-Wd§ = §_-7S§.§_-8R§;
         this.vipGiftList.mouseChildren = false;
         this.vipGiftList.mouseEnabled = false;
         this.vipGiftList.horizontalScrollPolicy = "off";
         this.vipGiftList.verticalScrollPolicy = "off";
         this.vipGiftList.defaultSkin = null;
         this.vipGiftList.visible = false;
         addChild(this.vipGiftList);
         this.confirmButton = new Button();
         this.confirmButton.defaultSkin = Utils.getClass("ButtonOrange");
         this.confirmButton.width = 65;
         this.confirmButton.height = 25;
         this.confirmButton.x = (width - this.confirmButton.width) / 2;
         this.confirmButton.y = height - 40;
         this.confirmButton.text = §_-4Y§.§_-Kf§["确定"];
         this.confirmButton.addEventListener(MouseEvent.CLICK,this.confirmButtonClick);
         addChild(this.confirmButton);
         this.loader = new §_-2Y§();
         this.loader.width = 152;
         this.loader.height = 80;
         this.loader.load(Utils.addPrefix(Settings.getInstance().getSecondUrl("vipReturnButton")));
      }
      
      public function set confirmHandler(param1:Function) : void
      {
         this._confirmHandler = param1;
      }
      
      public function set directionText(param1:String) : void
      {
         if(this.directionTextField != null)
         {
            this.directionTextField.htmlText = param1;
         }
      }
      
      public function set vipText(param1:String) : void
      {
         if(this.vipTextField != null)
         {
            this.vipTextField.htmlText = param1;
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
      
      override protected function setData() : void
      {
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
      
      override public function onEffectEnd() : void
      {
         super.onEffectEnd();
      }
      
      private function §_-TO§() : void
      {
         var _loc1_:Object = super.data;
         if(_loc1_ != null)
         {
            this.vipTextField.width = 370;
            this.directionTextField.width = 370;
            width = 395;
            this.directionTextField.x = §_-De§.middle(width,this.directionTextField.width);
            this.vipTextField.x = §_-De§.middle(width,this.vipTextField.width);
         }
      }
      
      private function onNavigateToURL(param1:MouseEvent) : void
      {
      }
   }
}

