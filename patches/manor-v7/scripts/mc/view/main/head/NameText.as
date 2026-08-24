package mc.view.main.head
{
   import common.MaterialLib;
   import flash.display.Bitmap;
   import flash.display.BitmapData;
   import flash.display.Sprite;
   import flash.events.MouseEvent;
   import flash.filters.GlowFilter;
   import flash.net.URLRequest;
   import flash.net.navigateToURL;
   import flash.text.TextField;
   import flash.text.TextFieldAutoSize;
   import flash.text.TextFormat;
   import mc.control.ViewControl;
   import mc.events.TipEvent;
   import mc.view.farm.GetCropID;
   
   public class NameText extends Sprite
   {
      
      private var _text:String = "";
      
      private var _vipBitmap:Bitmap;
      
      private var _textField:TextField;
      
      private var vipDiamond:Sprite;
      
      private var _vip:String = "";
      
      public function NameText()
      {
         super();
      }
      
      private function hideVipTip() : void
      {
         var _loc1_:TipEvent = new TipEvent(TipEvent.TIP_HIDE);
         _loc1_.tipType = "MouseTip";
         ViewControl.getInstance().dispatchEvent(_loc1_);
      }
      
      private function _MOUSE_OUT(param1:MouseEvent) : void
      {
         this.hideVipTip();
      }
      
      private function setVipPosition() : void
      {
         if(this._vipBitmap != null && this._textField != null)
         {
            this._vipBitmap.x = this._textField.width + 5;
            this._vipBitmap.y = 3;
         }
      }
      
      public function get text() : String
      {
         return this._text;
      }
      
      public function set text(param1:String) : void
      {
         this._text = param1;
         if(this._textField == null)
         {
            this._textField = new TextField();
            this._textField.filters = [new GlowFilter(16777215,1,3,3,7)];
            this._textField.selectable = false;
            this._textField.autoSize = TextFieldAutoSize.LEFT;
            this._textField.defaultTextFormat = new TextFormat("Verdana",12,3355443);
            addChild(this._textField);
         }
         var _loc2_:String = String(param1);
         if(_loc2_.indexOf("<") != -1 || _loc2_.indexOf(">") != -1)
         {
            _loc2_ = GetCropID.formatString(_loc2_);
         }
         this._textField.htmlText = _loc2_;
         this.setVipPosition();
      }
      
      private function dispatchData(param1:MouseEvent) : void
      {
      }
      
      private function _MOUSE_OVER(param1:MouseEvent) : void
      {
         if(param1.target.name == "vip")
         {
            this.showVipTip();
         }
      }
      
      public function set vip(param1:String) : void
      {
         var _loc2_:Class = null;
         var _loc3_:BitmapData = null;
         if(param1 == "" || param1 == null)
         {
            if(this._vipBitmap != null)
            {
               this.vipDiamond.removeChild(this._vipBitmap);
               this._vipBitmap = null;
            }
         }
         else if(param1 != this._vip)
         {
            if(this._vipBitmap != null)
            {
               this.vipDiamond.removeChild(this._vipBitmap);
               this._vipBitmap = null;
            }
            _loc2_ = MaterialLib.getInstance().getClass(param1) as Class;
            if(_loc2_ == null)
            {
               return;
            }
            _loc3_ = new _loc2_(16,13);
            this._vipBitmap = new Bitmap(_loc3_);
            this.vipDiamond = new Sprite();
            this.vipDiamond.name = "vip";
            this.vipDiamond.addChild(this._vipBitmap);
            this.vipDiamond.mouseChildren = false;
            this.vipDiamond.addEventListener(MouseEvent.ROLL_OVER,this._MOUSE_OVER);
            this.vipDiamond.addEventListener(MouseEvent.ROLL_OUT,this._MOUSE_OUT);
            addChild(this.vipDiamond);
            this.setVipPosition();
         }
         else if(this._vipBitmap != null)
         {
            this.setVipPosition();
         }
         this._vip = param1;
      }
      
      private function showVipTip() : void
      {
         var _loc1_:TipEvent = new TipEvent(TipEvent.TIP_SHOW);
         _loc1_.tipType = "MouseTip";
         _loc1_.tipArgument = "已启用 VIP 7级权益";
         ViewControl.getInstance().dispatchEvent(_loc1_);
      }
      
      public function get vip() : String
      {
         return this._vip;
      }
   }
}

