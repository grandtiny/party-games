package §_-W§
{
   import §_-0H§.§_-I§;
   import §_-Hw§.§_-TY§;
   import §_-Oq§.§_-Bn§;
   import §_-Oq§.§_-De§;
   import §_-Wy§.§_-2Z§;
   import com.qzone.qui.controls.Label;
   import common.Session;
   import common.§_-Ac§;
   import flash.display.Shape;
   import flash.display.Sprite;
   import flash.text.TextField;
   import flash.text.TextFormat;
   import framework.base.BaseTileItem;
   
   public class CropItem extends BaseTileItem
   {
      
      private var §_-XN§:int;
      
      private var §_-M2§:Boolean;
      
      private var §_-V0§:Label;
      
      private var _priceText:TextField;
      
      private var _icon:Sprite;
      
      public function CropItem()
      {
         super();
         this.§_-XN§ = -1;
         this.§_-M2§ = false;
         this._priceText = new TextField();
         this._priceText.selectable = false;
         this._priceText.width = 70;
         this._priceText.height = 20;
         addChild(this._priceText);
         this._priceText.x = -5;
         this._priceText.y = 60 + 2;
         this.§_-V0§ = new Label("");
         this.addChild(this.§_-V0§);
         this.§_-V0§.textDefaultFormat = new TextFormat("Verdana",12,9211020);
         this.§_-V0§.textField.filters = §_-2Z§.getTextGlowFilter();
         this.§_-V0§.y = §_-De§.right(60,this.§_-V0§.height) + 2;
         var _loc1_:Shape = new Shape();
         _loc1_.graphics.beginFill(16711680,0);
         _loc1_.graphics.drawRect(0,0,10,1);
         _loc1_.graphics.endFill();
         _loc1_.y = 100;
         addChild(_loc1_);
      }
      
      private function delaySetCrop() : void
      {
         if(_item == null)
         {
            return;
         }
         _material.setContent(§_-Ac§.§_-BK§,_item._id);
         this.§_-M2§ = true;
      }
      
      override public function set data(param1:Object) : void
      {
         if(param1 == null || param1 == _item && this.§_-M2§ == true)
         {
            this.§_-5-§();
            return;
         }
         super.data = param1;
         var _loc2_:§_-I§ = _item as §_-I§;
         if(_loc2_ == null)
         {
            this.§_-5-§();
            return;
         }
         this.§_-5-§();
         this.§_-XN§ = §_-TY§.setTimeout(this.delaySetCrop,1000);
         §_-Bn§.removeChild(this,this._icon);
         this._icon = null;
         if(_loc2_._isFood > 0)
         {
            this._icon = new ShopFoodMarkIcon();
            addChild(this._icon);
         }
         else if(_loc2_._isRestaurant > 0)
         {
            this._icon = new RestaurantMarkIcon();
            addChild(this._icon);
         }
         else if(_loc2_._isActivity > 0)
         {
            this._icon = new ActivityMarkIcon();
            addChild(this._icon);
         }
         else if(_loc2_.§_-Rc§ == true)
         {
            this.addGreenIcon();
         }
         else
         {
            §_-Bn§.removeChild(this,this._icon);
         }
         if(_loc2_._isMill > 0)
         {
            §_-Bn§.removeChild(this,this._priceText);
         }
         else
         {
            this._priceText.htmlText = "<p align=\"center\"><font color=\"#CC3300\">金币<font/> <font color=\"#FF6600\" face=\"Verdana\" size=\"11\"><b>" + _loc2_._price + "</b><font/></p>";
         }
         var _loc3_:TextFormat = this.§_-V0§.textDefaultFormat;
         var _loc4_:int = 0;
         var _loc5_:Session = Session.getInstance();
         if(_loc5_ != null && _loc5_.host != null)
         {
            _loc4_ = _loc5_.host.level;
         }
         if(_loc2_._lvl <= _loc4_)
         {
            _loc3_.color = 233195;
         }
         if(_loc2_._isRed == true)
         {
            _loc3_.color = 16737792;
            createBackground("ItemBgRed");
         }
         else if(_loc2_._isBlack == true)
         {
            _loc3_.color = 0;
            createBackground("ItemBgBlack");
         }
         else
         {
            createBackground("ItemBg");
         }
         this.§_-V0§.textDefaultFormat = _loc3_;
         this.§_-V0§.text = _loc2_._lvl.toString() + "级";
         §_-Wl§();
      }
      
      private function addGreenIcon() : void
      {
         var _loc1_:Sprite = new Sprite();
         _loc1_.graphics.beginFill(52224,1);
         _loc1_.graphics.drawRect(0,0,27,16);
         _loc1_.graphics.endFill();
         _loc1_.x = 34;
         _loc1_.y = 0;
         addChild(_loc1_);
         var _loc2_:TextField = new TextField();
         _loc2_.defaultTextFormat = new TextFormat("Verdana",12,16777215);
         _loc2_.width = 30;
         _loc2_.height = 20;
         _loc2_.mouseEnabled = false;
         _loc2_.text = "有机";
         _loc2_.selectable = false;
         _loc1_.addChild(_loc2_);
         this._icon = _loc1_;
         this._icon.mouseEnabled = false;
      }
      
      private function §_-5-§() : void
      {
         if(this.§_-XN§ > 0)
         {
            §_-TY§.clearTimeout(this.§_-XN§);
         }
         this.§_-XN§ = -1;
      }
   }
}
