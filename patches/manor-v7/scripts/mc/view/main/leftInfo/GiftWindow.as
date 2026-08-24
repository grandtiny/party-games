package mc.view.main.leftInfo
{
   import com.minutes.ui.control.LipiButton;
   import com.minutes.ui.core.LipiSkin;
   import com.qzone.corelib.js.JSProxy;
   import common.INI;
   import common.MaterialLib;
   import flash.display.Bitmap;
   import flash.display.BitmapData;
   import flash.display.SimpleButton;
   import flash.display.Sprite;
   import flash.events.MouseEvent;
   import flash.external.ExternalInterface;
   import flash.text.TextField;
   import flash.text.TextFieldAutoSize;
   import flash.text.TextFormat;
   import mc.model.MData;
   import mc.view.common.BaseWindow;
   import mc.view.common.HList;
   
   public class GiftWindow extends BaseWindow
   {
      
      private var _giftItemList:Array;
      
      private var _confirmHandler:Function;
      
      private var _directionText:String;
      
      private var directionTextField:TextField;
      
      private var confirmButton:LipiButton;
      
      private var vipIconSprite:Sprite;
      
      private var _vipGiftItemList:Array;
      
      private var vipGiftList:HList;
      
      private var renewalSprite:SimpleButton;
      
      private var giftList:HList;
      
      private var vipTextField:TextField;
      
      private var _giftData:Object;
      
      private var _vipText:String = "";
      
      private var label:TextField;
      
      private var isVipYear:Boolean;
      
      public function GiftWindow()
      {
         super();
         width = 380;
         height = 300;
         mode = true;
         titleIMG = MaterialLib.getInstance().getClass("GiftWindowTitle") as Class;
      }
      
      public function set giftItemList(param1:Array) : void
      {
         this._giftItemList = param1;
         if(this.giftList != null)
         {
            this.giftList.dataList = param1;
         }
      }
      
      public function setYellowInfo(param1:String) : void
      {
         var _loc2_:String = null;
         if(parseInt(param1) > 0 && parseInt(param1) <= 7)
         {
            addChild(this.label);
            addChild(this.vipIconSprite);
            _loc2_ = "";
            _loc2_ = INI.getInstance().data.vipRenewal.tips;
            this.label.htmlText = _loc2_.replace("{expireDays}",param1);
         }
         else
         {
            if(this.label.parent)
            {
               removeChild(this.label);
            }
            if(this.renewalSprite.parent)
            {
               removeChild(this.renewalSprite);
            }
            if(this.vipIconSprite.parent)
            {
               removeChild(this.vipIconSprite);
            }
         }
         this.setPostion();
      }
      
      public function set vipText(param1:String) : void
      {
         this._vipText = param1;
         if(this.vipTextField != null)
         {
            this.vipTextField.htmlText = param1;
         }
      }
      
      public function get directionText() : String
      {
         return this._directionText;
      }
      
      override public function init() : void
      {
         var _loc1_:TextFormat = new TextFormat("Verdana",13,12547910,null,null,null,null,null,"left",16,null,null,5);
         this.label = new TextField();
         this.label.backgroundColor = 16777176;
         this.label.background = true;
         this.label.width = 362;
         this.label.height = 45;
         this.label.x = 9;
         this.label.y = 35;
         this.label.selectable = false;
         this.label.multiline = true;
         this.label.wordWrap = true;
         this.label.defaultTextFormat = _loc1_;
         this.renewalSprite = MaterialLib.getInstance().getMaterial("Renewal") as SimpleButton;
         this.renewalSprite.x = 295;
         this.renewalSprite.y = 36;
         this.vipIconSprite = new Sprite();
         var _loc2_:Class = MaterialLib.getInstance().getClass("VipIcon") as Class;
         var _loc3_:BitmapData = new _loc2_(13,10);
         this.vipIconSprite.addChild(new Bitmap(_loc3_));
         this.vipIconSprite.x = 13;
         this.vipIconSprite.y = 40;
         this.directionTextField = new TextField();
         this.directionTextField.selectable = false;
         var _loc4_:TextFormat = new TextFormat("Verdana",12,8999699);
         _loc4_.leading = 8;
         this.directionTextField.defaultTextFormat = _loc4_;
         this.directionTextField.width = 340;
         this.directionTextField.wordWrap = true;
         this.directionTextField.multiline = true;
         this.directionTextField.x = 25;
         this.directionTextField.y = 40;
         this.directionTextField.autoSize = TextFieldAutoSize.LEFT;
         addChild(this.directionTextField);
         this.giftList = new HList(GiftItem,5);
         this.giftList.align = "center";
         this.giftList.width = 340;
         this.giftList.height = 90;
         this.giftList.x = Math.floor((width - this.giftList.width) / 2);
         addChild(this.giftList);
         this.vipTextField = new TextField();
         this.vipTextField.selectable = false;
         this.vipTextField.width = 340;
         this.vipTextField.x = 25;
         var _loc5_:TextFormat = new TextFormat("Verdana",12,10027008);
         _loc5_.leading = 5;
         this.vipTextField.defaultTextFormat = _loc5_;
         this.vipTextField.wordWrap = true;
         this.vipTextField.multiline = true;
         this.vipTextField.autoSize = TextFieldAutoSize.LEFT;
         addChild(this.vipTextField);
         this.vipGiftList = new HList(GiftItem,5);
         this.vipGiftList.visible = false;
         this.vipGiftList.align = "center";
         this.vipGiftList.width = 340;
         this.vipGiftList.height = 90;
         this.vipGiftList.x = Math.floor((width - this.vipGiftList.width) / 2);
         addChild(this.vipGiftList);
         this.confirmButton = new LipiButton();
         this.confirmButton.bgAlpha = 0;
         this.confirmButton.bgSkin = new LipiSkin(MaterialLib.getInstance().getClass("ButtonOrange"));
         this.confirmButton.width = 65;
         this.confirmButton.height = 25;
         this.confirmButton.x = (width - this.confirmButton.width) / 2;
         this.confirmButton.y = height - 40;
         this.confirmButton.label = "确定";
         this.confirmButton.textColor = 16777215;
         this.confirmButton.addEventListener(MouseEvent.CLICK,this.confirmButtonClick);
         addChild(this.confirmButton);
         if(this.directionText != null)
         {
            this.directionTextField.htmlText = this.directionText;
         }
         if(this.giftItemList != null)
         {
            this.giftList.dataList = this.giftItemList;
         }
         if(this.vipGiftItemList != null && this.vipGiftItemList.length > 0)
         {
            this.vipGiftList.dataList = this.vipGiftItemList;
            this.vipGiftList.visible = true;
            this.confirmButton.y = height - 40;
            this.y -= 30;
         }
         else
         {
            this.vipGiftList.visible = false;
            this.confirmButton.y = height - 40;
         }
         this.vipTextField.htmlText = this.vipText;
         this.setPostion();
      }
      
      public function set confirmHandler(param1:Function) : void
      {
         this._confirmHandler = param1;
      }
      
      public function set directionText(param1:String) : void
      {
         this._directionText = param1;
         if(this.directionTextField != null)
         {
            this.directionTextField.htmlText = param1;
         }
      }
      
      private function confirmButtonClick(param1:MouseEvent) : void
      {
         closeHandler();
         if(this._confirmHandler != null)
         {
            this._confirmHandler();
         }
      }
      
      public function get vipGiftItemList() : Array
      {
         return this._vipGiftItemList;
      }
      
      public function get giftItemList() : Array
      {
         return this._giftItemList;
      }
      
      private function setPostion() : void
      {
         if(!this.giftList)
         {
            return;
         }
         if(Boolean(this.label) && Boolean(this.label.parent))
         {
            this.directionTextField.y = this.label.y + this.label.height + 5;
         }
         else
         {
            this.directionTextField.y = 40;
         }
         this.giftList.y = this.directionTextField.y + this.directionTextField.height + 10;
         this.vipTextField.y = this.giftList.y + this.giftList.height + 5;
         this.vipGiftList.y = this.vipTextField.y + this.vipTextField.height + 10;
         if(this.vipGiftItemList != null && this.vipGiftItemList.length > 0)
         {
            height = this.vipGiftList.y + this.vipGiftList.height + 50;
            this.confirmButton.y = height - 40;
            this.y -= 30;
         }
         else
         {
            height = this.giftList.y + this.giftList.height + 50;
            this.confirmButton.y = height - 40;
         }
      }
      
      public function get vipText() : String
      {
         return this._vipText;
      }
      
      public function get giftData() : Object
      {
         return this._giftData;
      }
      
      private function onNavigateToURL(param1:MouseEvent) : void
      {
      }
      
      public function set giftData(param1:Object) : void
      {
         this._giftData = param1;
         this.directionText = param1["direction"];
         this.giftItemList = param1["item"];
         if(param1.hasOwnProperty("vipText"))
         {
            this.vipText = param1["vipText"];
         }
         if(param1.hasOwnProperty("vipItem") && param1["vipItem"] != false)
         {
            this.vipGiftItemList = param1["vipItem"];
         }
         this.setPostion();
      }
      
      public function set vipGiftItemList(param1:Array) : void
      {
         this._vipGiftItemList = param1;
         if(this.vipGiftList != null)
         {
            if(param1 != null && param1.length > 0)
            {
               this.vipGiftList.dataList = param1;
               this.vipGiftList.visible = true;
               height = 380;
               this.confirmButton.y = height - 40;
               this.y -= 30;
            }
            else
            {
               this.vipGiftList.visible = false;
               height = 300;
               this.confirmButton.y = height - 40;
            }
         }
      }
   }
}

