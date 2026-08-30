package §_-W§
{
   import §_-0H§.Item;
   import §_-Wy§.§_-2Z§;
   import com.qzone.qui.controls.Label;
   import flash.display.Shape;
   import flash.text.TextField;
   import flash.text.TextFormat;
   import framework.base.BaseTileItem;
   
   public class ToolItem extends BaseTileItem
   {
      private var _priceText:TextField;
      
      public function ToolItem()
      {
         super();
         createBackground("ItemBg");
         this._priceText = new TextField();
         this._priceText.selectable = false;
         this._priceText.width = Math.max(this.width + 10,100);
         this._priceText.height = 20;
         addChild(this._priceText);
         this._priceText.x = (this.width - this._priceText.width) / 2;
         if(§_-1H§ != null)
         {
            this._priceText.y = §_-1H§.height + 2;
         }
         else
         {
            this._priceText.y = 62;
         }
         var _loc1_:Shape = new Shape();
         _loc1_.graphics.beginFill(16711680,0);
         _loc1_.graphics.drawRect(0,0,10,1);
         _loc1_.graphics.endFill();
         _loc1_.y = 100;
         addChild(_loc1_);
      }
      
      override public function set data(param1:Object) : void
      {
         var _loc3_:Label = null;
         if(param1 == null || param1 == super._item)
         {
            return;
         }
         super.data = param1;
         var _loc2_:Item = super._item as Item;
         if(_loc2_ == null)
         {
            return;
         }
         if(_loc2_._price != 0)
         {
            this._priceText.htmlText = "<p align=\"center\"><font face=\"Verdana\" color=\"#CC3300\">金币<font/> <font color=\"#FF6600\" face=\"Verdana\" size=\"11\"><b>" + _loc2_._price + "</b><font/></p>";
         }
         else if(_loc2_._fb != 0)
         {
            this._priceText.htmlText = "<p align=\"center\"><font face=\"Verdana\" color=\"#003366\">元宝<font/> <font color=\"#0099FF\" face=\"Verdana\" size=\"11\"><b>" + _loc2_._fb + "</b><font/></p>";
         }
         else
         {
            this._priceText.htmlText = "<p align=\"center\"><font face=\"Verdana\" color=\"#CC3300\">免费<font/></p>";
         }
         _material.setContent(_loc2_._type.toString(),_loc2_._id);
         if(_loc2_._saleOut == true)
         {
            _material.filters = §_-2Z§.getDisableFilter();
            _loc3_ = new Label("已售完");
            addChild(_loc3_);
            _loc3_.x = 10;
            _loc3_.y = 40;
            _loc3_.textField.setTextFormat(new TextFormat("Verdana",12,13369344));
            _loc3_.textField.filters = §_-2Z§.getTextGlowFilter();
         }
         if(_loc2_._shortage == true)
         {
            §_-1H§.filters = §_-2Z§.getDisableFilter();
         }
         else
         {
            §_-1H§.filters = null;
         }
         §_-Wl§();
      }
   }
}
