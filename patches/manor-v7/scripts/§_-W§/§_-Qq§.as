package §_-W§
{
   import §_-0H§.§_-I§;
   import §_-52§.§_-KB§;
   import §_-8S§.§_-RG§;
   import §_-Hw§.§_-3t§;
   import §_-N-§.§_-2Y§;
   import §_-R0§.§_-7S§;
   import com.qzone.qui.containers.HBox;
   import com.qzone.qui.containers.TileList;
   import com.qzone.qui.controls.Button;
   import com.qzone.qui.controls.Label;
   import common.Session;
   import common.Settings;
   import common.misc.Utils;
   import common.view.window.§_-Ok§;
   import flash.display.DisplayObjectContainer;
   import flash.display.Shape;
   import flash.display.SimpleButton;
   import flash.events.Event;
   import flash.events.MouseEvent;
   import flash.external.ExternalInterface;
   import flash.text.TextFieldAutoSize;
   import framework.base.§_-Eh§;
   
   public class §_-Qq§ extends §_-Eh§
   {
      
      private var _loader2:§_-2Y§;
      
      private var §_-4L§:Array;
      
      private var §_-1o§:Array;
      
      private var §_-K3§:Array;
      
      private var _isVip:Boolean;
      
      private var §_-73§:SimpleButton;
      
      private const _tile_height:int = 300;
      
      private var §_-21§:Array;
      
      private var §_-37§:Array;
      
      private const _tile_top:int = 23;
      
      private var §_-Ko§:Array;
      
      private var §_-JZ§:String;
      
      private var §_-a5§:Label;
      
      private var _loader:§_-2Y§;

      private var _pageTile:TileList;

      private var _pageWidth:int;
      
      public function §_-Qq§(param1:DisplayObjectContainer, param2:int, param3:int)
      {
         var _loc4_:HBox = null;
         super(param1,param2,param3);
         this._pageWidth = param2;
         this._pageTile = null;
         this.§_-JZ§ = "green";
         this.§_-21§ = null;
         this.§_-4L§ = null;
         _loc4_ = new HBox(param2 - 2,27);
         _loc4_.verticalScrollPolicy = §_-RG§.§_-YA§;
         _loc4_.horizontalScrollPolicy = §_-RG§.§_-YA§;
         _loc4_.§_-4R§ = §_-7S§.LEFT;
         _loc4_.§_-Wd§ = §_-7S§.§_-8R§;
         _loc4_.paddingH = 3;
         _loc4_.paddingV = 0;
         _loc4_.defaultSkin = null;
         _loc4_.backgroundColor = 14219772;
         _loc4_.backgroundAlpha = 1;
         _loc4_.addEventListener(MouseEvent.CLICK,this.onSeedTypeClicked);
         this.addChild(_loc4_);
         var _loc5_:Button = new Button("有机种子");
         _loc5_.name = "green";
         _loc5_.defaultSkin = Shape;
         _loc5_.selectedSkin = Utils.getClass("SeedTypeBtnSelectedSkin");
         _loc5_.useHandCursor = true;
         _loc5_.textSelectedFormat = §_-3t§.clone(_loc5_.textSelectedFormat);
         _loc5_.textSelectedFormat.color = 16777215;
         _loc5_.textSelectedFormat.bold = true;
         _loc5_.textDefaultFormat = §_-3t§.clone(_loc5_.textDefaultFormat);
         _loc5_.textDefaultFormat.color = 3785720;
         _loc5_.textOverFormat = §_-3t§.clone(_loc5_.textOverFormat);
         _loc5_.textOverFormat.color = null;
         _loc5_.toggle = true;
         _loc5_.selected = true;
         _loc5_.useHandCursor = true;
         _loc5_.height = 25;
         _loc5_.width = 80;
         var _loc6_:Button = new Button("普通种子");
         _loc6_.name = "normal";
         _loc6_.defaultSkin = Shape;
         _loc6_.selectedSkin = Utils.getClass("SeedTypeBtnSelectedSkin");
         _loc6_.useHandCursor = true;
         _loc6_.textSelectedFormat = §_-3t§.clone(_loc6_.textSelectedFormat);
         _loc6_.textSelectedFormat.color = 16777215;
         _loc6_.textSelectedFormat.bold = true;
         _loc6_.textDefaultFormat = §_-3t§.clone(_loc6_.textDefaultFormat);
         _loc6_.textDefaultFormat.color = 3785720;
         _loc6_.textOverFormat = §_-3t§.clone(_loc6_.textOverFormat);
         _loc6_.textOverFormat.color = null;
         _loc6_.toggle = true;
         _loc6_.useHandCursor = true;
         _loc6_.height = 25;
         _loc6_.width = 80;
         var _loc7_:Button = new Button("红土地种子");
         _loc7_.name = "advanced";
         _loc7_.defaultSkin = _loc6_.defaultSkin;
         _loc7_.selectedSkin = _loc6_.selectedSkin;
         _loc7_.textDefaultFormat = _loc6_.textDefaultFormat;
         _loc7_.textSelectedFormat = _loc6_.textSelectedFormat;
         _loc7_.textOverFormat = _loc6_.textOverFormat;
         _loc7_.toggle = true;
         _loc7_.useHandCursor = true;
         _loc7_.height = 25;
         var _loc8_:Button = new Button("黑土地种子");
         _loc8_.name = "black";
         _loc8_.defaultSkin = _loc6_.defaultSkin;
         _loc8_.selectedSkin = _loc6_.selectedSkin;
         _loc8_.textDefaultFormat = _loc6_.textDefaultFormat;
         _loc8_.textSelectedFormat = _loc6_.textSelectedFormat;
         _loc8_.textOverFormat = _loc6_.textOverFormat;
         _loc8_.toggle = true;
         _loc8_.useHandCursor = true;
         _loc8_.height = 25;
         var _loc9_:Button = new Button("VIP专属种子");
         _loc9_.name = "vip";
         _loc9_.defaultSkin = _loc6_.defaultSkin;
         _loc9_.selectedSkin = Utils.getClass("SeedTypeVipBtnSelectedSkin");
         _loc9_.textDefaultFormat = §_-3t§.clone(_loc6_.textDefaultFormat);
         _loc9_.textDefaultFormat.color = 16618254;
         _loc9_.textSelectedFormat = §_-3t§.clone(_loc6_.textSelectedFormat);
         _loc9_.textSelectedFormat.color = 16618254;
         _loc9_.textOverFormat = _loc6_.textOverFormat;
         _loc9_.toggle = true;
         _loc9_.useHandCursor = true;
         _loc9_.height = 25;
         var _loc10_:§_-KB§ = new §_-KB§();
         _loc10_.addTarget(_loc5_);
         _loc4_.addElement(_loc5_);
         _loc10_.addTarget(_loc6_);
         _loc4_.addElement(_loc6_);
         _loc10_.addTarget(_loc7_);
         _loc4_.addElement(_loc7_);
         _loc10_.addTarget(_loc8_);
         _loc4_.addElement(_loc8_);
         _loc10_.addTarget(_loc9_);
         _loc4_.addElement(_loc9_);
         this.§_-a5§ = new Label(null,null,TextFieldAutoSize.LEFT);
         this.§_-a5§.padingH = 35;
         this.§_-a5§.padingV = 5;
         this.§_-a5§.x = 2;
         this.§_-a5§.width = param2 - 5;
         this.§_-a5§.y += _loc4_.height;
         this.§_-a5§.height = 30;
         §_-Ok§.addTarget(this.§_-a5§);
         this.§_-a5§.visible = false;
         addChild(this.§_-a5§);
         this._isVip = Boolean(Session.getInstance().host._yellowstatus);
      }
      
      private function seedSort2(param1:§_-I§, param2:§_-I§) : int
      {
         if(param1 == null || param2 == null)
         {
            return 0;
         }
         var _loc3_:int = param1._lvl >= param2._lvl ? 1 : -1;
         if(param1._lvl == param2._lvl && !param1._isRed && param2._isRed)
         {
            _loc3_ = -1;
         }
         return _loc3_;
      }
      
      override protected function onCreateTile() : void
      {
         if(this._pageTile != null)
         {
            this._pageTile.paddingH = 23;
            this._pageTile.paddingV = 10;
            this._pageTile.gapH = 0;
            this._pageTile.gapV = 0;
            this._pageTile.tileWidth = 90;
            this._pageTile.tileHeight = 98;
            this._pageTile.defaultSkin = null;
            this._pageTile.horizontalScrollPolicy = §_-RG§.§_-YA§;
            this._pageTile.itemRenderer = CropItem;
            this._pageTile.y = this._tile_top;
            this._pageTile.width = this._pageWidth - 5;
            this._pageTile.height = this._tile_height;
         }
      }

      override public function get dataList() : Array
      {
         if(this._pageTile == null)
         {
            return null;
         }
         return this._pageTile.dataProvider;
      }
      
      override public function set dataList(param1:Array) : void
      {
         if(this._pageTile == null)
         {
            this._pageTile = new TileList();
            this.onCreateTile();
            addChild(this._pageTile);
         }
         this.§_-J9§(param1);
         if(this.§_-JZ§ == "green")
         {
            this._pageTile.dataProvider = this.§_-37§;
         }
         else if(this.§_-JZ§ == "normal")
         {
            this._pageTile.dataProvider = this.§_-21§;
         }
         else if(this.§_-JZ§ == "advanced")
         {
            this._pageTile.dataProvider = this.§_-4L§;
         }
         else if(this.§_-JZ§ == "mill")
         {
            this._pageTile.dataProvider = this.§_-K3§;
         }
         else if(this.§_-JZ§ == "vip")
         {
            this._pageTile.dataProvider = this.§_-1o§;
         }
         else if(this.§_-JZ§ == "black")
         {
            this._pageTile.dataProvider = this.§_-Ko§;
         }
      }

      override public function set §_-Q8§(param1:Boolean) : void
      {
         super.§_-Q8§ = param1;
         if(this._pageTile != null)
         {
            this._pageTile.visible = !param1;
         }
      }
      
      private function onNavigateToURL(param1:MouseEvent) : void
      {
      }
      
      private function seedSort(param1:§_-I§, param2:§_-I§) : int
      {
         if(param1 == null || param2 == null)
         {
            return 0;
         }
         var _loc3_:int = param1._lvl > param2._lvl ? 1 : -1;
         if(param1._lvl == param2._lvl)
         {
            _loc3_ = param1._id > param2._id ? 1 : -1;
         }
         return _loc3_;
      }
      
      private function §_-J9§(param1:Array) : void
      {
         var _loc2_:§_-I§ = null;
         this.§_-21§ = [];
         this.§_-4L§ = [];
         this.§_-K3§ = [];
         this.§_-1o§ = [];
         this.§_-Ko§ = [];
         this.§_-37§ = [];
         for each(_loc2_ in param1)
         {
            if(_loc2_.§_-Rc§ == true)
            {
               this.§_-37§.push(_loc2_);
            }
            else if(_loc2_._isVip == 1)
            {
               this.§_-1o§.push(_loc2_);
            }
            else if(_loc2_._isMill == 1)
            {
               this.§_-K3§.push(_loc2_);
            }
            else if(_loc2_._isRed == true)
            {
               this.§_-4L§.push(_loc2_);
            }
            else if(_loc2_._isBlack == true)
            {
               this.§_-Ko§.push(_loc2_);
            }
            else
            {
               this.§_-21§.push(_loc2_);
            }
         }
         this.§_-21§.sort(this.seedSort);
         this.§_-4L§.sort(this.seedSort);
         this.§_-K3§.sort(this.seedSort2);
         this.§_-1o§.sort(this.seedSort);
      }
      
      private function onSeedTypeClicked(param1:Event) : void
      {
         var _loc3_:Array = null;
         var _loc4_:String = null;
         if(param1 == null)
         {
            return;
         }
         var _loc2_:Button = param1.target as Button;
         if(_loc2_ != null && this.§_-JZ§ != _loc2_.name)
         {
            this.§_-JZ§ = _loc2_.name;
            if(this._pageTile == null)
            {
               return;
            }
            _loc3_ = null;
            if(this.§_-JZ§ == "green")
            {
               _loc3_ = this.§_-37§;
            }
            else if(this.§_-JZ§ == "normal")
            {
               _loc3_ = this.§_-21§;
            }
            else if(this.§_-JZ§ == "advanced")
            {
               _loc3_ = this.§_-4L§;
            }
            else if(this.§_-JZ§ == "black")
            {
               _loc3_ = this.§_-Ko§;
            }
            if(this.§_-JZ§ == "green" || this.§_-JZ§ == "normal" || this.§_-JZ§ == "advanced" || this.§_-JZ§ == "black")
            {
               this._pageTile.tileWidth = 90;
               this._pageTile.tileHeight = 98;
               this._pageTile.y = this._tile_top;
               this.§_-a5§.visible = false;
               this._pageTile.itemRenderer = CropItem;
               this._pageTile.dataProvider = _loc3_;
               this._pageTile.height = this._tile_height;
               if(this._loader)
               {
                  this._loader.visible = false;
               }
               if(this.§_-73§)
               {
                  this.§_-73§.visible = false;
               }
               this._pageTile.scrollVerticalReset();
            }
            else if(this.§_-JZ§ == "vip")
            {
               this._pageTile.tileWidth = 149;
               this._pageTile.tileHeight = 170;
               this._pageTile.y = this._tile_top;
               this._pageTile.itemRenderer = §_-4m§;
               this._pageTile.dataProvider = this.§_-1o§;
               this._pageTile.height = this._tile_height - this.§_-a5§.height - 3;
               this._pageTile.y = this._tile_top + this.§_-a5§.height + 3;
               if(this._isVip)
               {
                  this.§_-a5§.text = Settings.getInstance().getDynamicTip("shopVipTip");
               }
               else
               {
                  this.§_-a5§.text = Settings.getInstance().getDynamicTip("shopUnvipTip");
               }
               this.§_-a5§.visible = true;
               if(this._loader == null)
               {
                  this._loader = new §_-2Y§();
                  this._loader.y = 29;
                  this._loader.x = 1;
                  this._loader.load(Settings.getInstance().getSecondUrl("VipSeedTabBg"));
                  addChildAt(this._loader,0);
               }
               else
               {
                  this._loader.visible = true;
               }
               this._pageTile.scrollVerticalReset();
            }
         }
      }
   }
}

