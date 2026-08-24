package mc.view.main.window.shop
{
   import cn.snowkit.utils.ETimer;
   import com.minutes.ui.collections.LipiTile2;
   import com.qzone.qfa.managers.LoadManager;
   import com.qzone.qfa.managers.events.LoaderEvent;
   import com.qzone.qui.containers.HBox;
   import com.qzone.qui.controls.Button;
   import com.qzone.qui.controls.scrollClasses.ScrollPolicy;
   import com.qzone.qui.core.Align;
   import com.qzone.qui.makers.RadioGroup;
   import com.qzone.qui.utils.TextFormatUtil;
   import common.INI;
   import common.MaterialLib;
   import flash.display.Bitmap;
   import flash.display.Shape;
   import flash.display.Sprite;
   import flash.events.Event;
   import flash.events.MouseEvent;
   import flash.geom.Point;
   import flash.net.URLRequest;
   import flash.net.navigateToURL;
   import flash.text.TextField;
   import flash.text.TextFormat;
   import flash.utils.Timer;
   import mc.control.Command;
   import mc.control.ViewControl;
   import mc.events.WindowEvent;
   import mc.model.MData;
   import mc.model.MainData;
   import mc.view.ViewEvent;
   import mc.view.common.DataLoading;
   import mc.view.farm.GetCropID;
   import mc.view.main.WindowControl.WindowClassLib;
   
   public class ShopSeedTile extends Sprite
   {
      
      public static var isGetVipPic:Boolean = false;
      
      private var timer:Timer;
      
      private var alertTxt2:TextField;
      
      private var mainData:MainData;
      
      private var _vipMc:Sprite;
      
      private var txtSprite:Sprite;
      
      private var _vipBtn:Sprite;
      
      private var _loadManger:LoadManager;
      
      private var _yellowText:TextField;
      
      private var tile:LipiTile2;
      
      private var _isVipAnimal:Boolean;
      
      private var dataLoading:DataLoading;
      
      private var tileLoc:Number;
      
      public function ShopSeedTile()
      {
         var _loc1_:HBox = null;
         var _loc3_:Button = null;
         this.alertTxt2 = new TextField();
         super();
         this.mainData = MData.getInstance().mainData;
         _loc1_ = new HBox(482,30);
         _loc1_.verticalScrollPolicy = ScrollPolicy.OFF;
         _loc1_.horizontalScrollPolicy = ScrollPolicy.OFF;
         _loc1_.alignH = Align.LEFT;
         _loc1_.alignV = Align.TOP;
         _loc1_.paddingH = 10;
         _loc1_.paddingV = 5;
         _loc1_.defaultSkin = null;
         _loc1_.backgroundColor = 15651977;
         _loc1_.backgroundAlpha = 1;
         var _loc2_:RadioGroup = new RadioGroup();
         _loc3_ = new Button("常规动物");
         _loc3_.name = "normal";
         _loc3_.defaultSkin = Shape;
         _loc3_.selectedSkin = MaterialLib.getInstance().getClass("SeedNormalBtnSelectedSkin");
         _loc3_.useHandCursor = true;
         _loc3_.textSelectedFormat = TextFormatUtil.clone(_loc3_.textSelectedFormat);
         _loc3_.textSelectedFormat.color = 16777215;
         _loc3_.textDefaultFormat = TextFormatUtil.clone(_loc3_.textDefaultFormat);
         _loc3_.textDefaultFormat.color = 10773568;
         _loc3_.textOverFormat = TextFormatUtil.clone(_loc3_.textOverFormat);
         _loc3_.textOverFormat.color = null;
         _loc3_.toggle = true;
         _loc3_.selected = true;
         _loc2_.addTarget(_loc3_);
         _loc1_.addElement(_loc3_);
         var _loc4_:Button = new Button("餐厅专供动物");
         _loc4_.name = "restaurant";
         _loc4_.defaultSkin = _loc3_.defaultSkin;
         _loc4_.selectedSkin = _loc3_.selectedSkin;
         _loc4_.textDefaultFormat = _loc3_.textDefaultFormat;
         _loc4_.textSelectedFormat = _loc3_.textSelectedFormat;
         _loc4_.textOverFormat = _loc3_.textOverFormat;
         _loc4_.toggle = true;
         _loc2_.addTarget(_loc4_);
         _loc1_.addElement(_loc4_);
         _loc3_.useHandCursor = true;
         _loc4_.useHandCursor = true;
         var _loc5_:Button = new Button("VIP专属动物");
         _loc5_.name = "vipAnimal";
         _loc5_.defaultSkin = _loc3_.defaultSkin;
         _loc5_.selectedSkin = _loc3_.selectedSkin;
         _loc5_.textSelectedFormat = TextFormatUtil.clone(_loc3_.textSelectedFormat);
         _loc5_.textSelectedFormat.color = 16570368;
         _loc5_.textDefaultFormat = TextFormatUtil.clone(_loc3_.textDefaultFormat);
         _loc5_.textDefaultFormat.color = 16733440;
         _loc5_.textOverFormat = TextFormatUtil.clone(_loc3_.textOverFormat);
         _loc5_.textOverFormat.color = null;
         _loc5_.toggle = true;
         _loc2_.addTarget(_loc5_);
         _loc1_.addElement(_loc5_);
         _loc5_.useHandCursor = true;
         _loc1_.addEventListener(MouseEvent.CLICK,this.filterTypeClick);
         _loc1_.y = 18;
         this.addChild(_loc1_);
         this.tile = new LipiTile2(CropItem,5,90,98,23,10);
         this.tile.y = 18 + _loc1_.height;
         this.tileLoc = this.tile.y;
         this.tile.width = 480;
         this.tile.height = 300;
         this.tile.bgAlpha = 0;
         this.tile.addEventListener(ViewEvent.CHILD_CLICK,this.tileChildClick);
         addChild(this.tile);
         this.dataLoading = new DataLoading();
         this.dataLoading.addEventListener(ViewEvent.LINK_CLICK,this.linkClick);
         this.dataLoading.x = this.tile.width / 2;
         this.dataLoading.y = this.tile.height / 2;
         addChild(this.dataLoading);
         var _loc6_:TextFormat = new TextFormat("Verdana",12,8999699,null,null,null,null,null,"center");
         this.alertTxt2.backgroundColor = 16777176;
         this.alertTxt2.background = true;
         this.alertTxt2.width = 478;
         this.alertTxt2.height = 18;
         this.alertTxt2.selectable = false;
         addChild(this.alertTxt2);
         this.alertTxt2.defaultTextFormat = _loc6_;
         ViewControl.getInstance().addEventListener("animal_change",this.checkAnimal);
         this.checkAnimal();
      }
      
      private function setPositionByLevel() : void
      {
         var rowHeight:Number;
         var level:int;
         var host:Object;
         var l:int;
         var i:int;
         var row:int;
         var position:Number = NaN;
         var contentHeight:int = 0;
         var h1:int = 0;
         this.tile.vScrollPosition = 0;
         ETimer.clearTimeout(this.timer);
         if(this.tile == null || this.tile.dataList == null)
         {
            return;
         }
         host = MData.getInstance().mainData.host;
         level = MData.getInstance().mainData.expToGrade(host["exp"]);
         if(level < 10)
         {
            return;
         }
         contentHeight = this.tile.contentPane.height;
         row = Math.ceil(this.tile.dataList.length / 5);
         rowHeight = 196;
         trace("行",row);
         trace("位置",this.tile.vScrollPosition);
         if(row <= 3)
         {
            return;
         }
         i = 0;
         l = int(this.tile.dataList.length);
         while(i < l)
         {
            if(this.tile.dataList[i].cLevel > level)
            {
               break;
            }
            position = Number(this.tile.getPosition(i)[1]);
            i++;
         }
         h1 = this.tile.height - rowHeight;
         this.timer = ETimer.setTimeout(300,function():void
         {
            var _loc1_:* = tile.verticalScrollBar.maxScrollPosition;
            position = (position - h1) * _loc1_ / (contentHeight - tile.height);
            position = position > _loc1_ ? Number(_loc1_) : position;
            tile.vScrollPosition = position;
         });
      }
      
      private function addVipText() : void
      {
         var _loc1_:TextFormat = null;
         var _loc2_:XML = null;
         if(this.txtSprite == null)
         {
            this.txtSprite = new Sprite();
            this.txtSprite.graphics.beginFill(16777176);
            this.txtSprite.graphics.drawRect(0,0,470,30);
            this.txtSprite.graphics.endFill();
            this.txtSprite.x = 10;
            this.txtSprite.y = 5;
            if(this._yellowText == null)
            {
               this._yellowText = new TextField();
            }
            this._yellowText.y = 5;
            this._yellowText.width = 478;
            this._yellowText.height = 18;
            this._yellowText.selectable = false;
            this.txtSprite.addChild(this._yellowText);
            _loc1_ = new TextFormat("Verdana",12,8999699,null,null,null,null,null,"left");
            _loc1_.indent = 15;
            this._yellowText.defaultTextFormat = _loc1_;
            _loc2_ = INI.getInstance().data.vipAnimal[0];
            this._yellowText.text = this.mainData.host["yellowstatus"] >= 1 ? _loc2_.yellowText.vip[0].@content : _loc2_.yellowText.vip[1].@content;
            this._vipMc.addChildAt(this.txtSprite,1);
         }
      }
      
      private function vipBtnHandler(param1:MouseEvent) : void
      {
      }
      
      public function set dataList(param1:Array) : void
      {
         this.tile.dataList = param1;
         if(this._isVipAnimal == false)
         {
            this.setPositionByLevel();
         }
      }
      
      public function set errText(param1:String) : void
      {
         this.dataLoading.errorText = param1;
      }
      
      private function filterTypeClick(param1:MouseEvent) : void
      {
         var _loc2_:Button = param1.target as Button;
         if(_loc2_)
         {
            this.mainData.seedType = _loc2_.name;
            this.vipAnimalHandler(_loc2_.name);
         }
      }
      
      private function vipAnimalHandler(param1:String) : void
      {
         if(param1 == "vipAnimal")
         {
            this._isVipAnimal = true;
            if(this._vipMc == null)
            {
               this._vipMc = new Sprite();
               addChildAt(this._vipMc,0);
               this._vipMc.y = 48;
            }
            else
            {
               this._vipMc.visible = true;
            }
            this._loadManger = new LoadManager();
            this._loadManger.add(GetCropID.getVipAnimalURL("VipSeedTabBg.jpg"));
            if(MData.getInstance().mainData.host["yellowstatus"] >= 1)
            {
               this._loadManger.add(GetCropID.getVipAnimalURL("vipUser.png"));
            }
            else
            {
               this._loadManger.add(GetCropID.getVipAnimalURL("normalUser.png"));
            }
            if(this.mainData.vipIcon == null)
            {
               this._loadManger.add(GetCropID.getVipAnimalURL("VipIcon.png"));
            }
            this._loadManger.addEventListener(LoaderEvent.COMPLETE,this.completeHandler);
            this._loadManger.addEventListener(LoaderEvent.QUEUE_COMPLETE,this.completeHandler);
            this._loadManger.addEventListener(LoaderEvent.ERROR,this.completeHandler);
            this._loadManger.start();
         }
         else
         {
            this._isVipAnimal = false;
            ShopSeedTile.isGetVipPic = false;
            this.tile.childItem.houseLoc = new Point(46,46);
            this.tile.childItem.leveltxtLoca = new Point(1,44);
            this.tile.childItem.vipIconVisible = false;
            this.tile.childItem.hasVipTxt = false;
            this.tile.y = this.tileLoc;
            this.tile.height = 300;
            this.tile.colAmount = 5;
            this.tile.itemWidth = 90;
            this.tile.itemHeight = 98;
            if(this._vipMc)
            {
               this._vipMc.visible = false;
            }
            Command.getInstance().mainCommand.getSeedInfo();
         }
      }
      
      private function tileChildClick(param1:ViewEvent) : void
      {
         WindowClassLib.register("ShopSeedWindow",ShopSeedWindow);
         var _loc2_:WindowEvent = new WindowEvent(WindowEvent.OPEN);
         _loc2_.windowName = "ShopSeedWindow";
         _loc2_.windowArgument = param1.data;
         ViewControl.getInstance().dispatchEvent(_loc2_);
      }
      
      private function completeHandler(param1:LoaderEvent) : void
      {
         var _loc2_:String = null;
         if(param1.type == LoaderEvent.COMPLETE)
         {
            _loc2_ = param1.item.url;
            if(_loc2_.substr(_loc2_.length - 3,_loc2_.length) == "jpg")
            {
               this._vipMc.addChildAt(param1.item.data as Bitmap,0);
            }
            else if(_loc2_.substr(_loc2_.length - 11,_loc2_.length) == "VipIcon.png")
            {
               this.mainData.vipIcon = param1.item.data as Bitmap;
            }
            else
            {
               this.mainData.vipBtn = param1.item.data as Bitmap;
            }
         }
         else if(param1.type == LoaderEvent.QUEUE_COMPLETE)
         {
            ShopSeedTile.isGetVipPic = true;
            this.tile.childItem.houseLoc = new Point(105,105);
            this.tile.childItem.leveltxtLoca = new Point(1,103);
            this.tile.childItem.vipIconVisible = true;
            this.tile.childItem.hasVipTxt = true;
            this.tile.y = this.tileLoc + 40;
            this.tile.height = 260;
            this.tile.colAmount = 3;
            this.tile.itemWidth = 155;
            this.tile.itemHeight = 175;
            this.addVipText();
            Command.getInstance().mainCommand.getSeedInfo();
         }
         else if(param1.type == LoaderEvent.ERROR)
         {
         }
      }
      
      public function set loadingVisible(param1:Boolean) : void
      {
         this.dataLoading.visible = param1;
         this.tile.visible = !param1;
      }
      
      public function get dataList() : Array
      {
         return this.tile.dataList;
      }
      
      private function checkAnimal(param1:Event = null) : void
      {
         var _loc2_:Object = MData.getInstance().mainData;
         var _loc3_:Object = _loc2_.host;
         var _loc4_:Number = Number(_loc2_.getAnimalNum(_loc3_["house1"],"窝"));
         var _loc5_:Number = Number(_loc2_.getAnimalNum(_loc3_["house2"],"棚"));
         var _loc6_:Number = _loc4_ - _loc3_["animal1"];
         var _loc7_:Number = _loc5_ - _loc3_["animal2"];
         if(_loc6_ <= 0 && _loc7_ <= 0)
         {
            this.alertTxt2.htmlText = "温馨提示：<b>窝</b>已经住满了，<b>棚</b>已经住满了";
         }
         if(_loc7_ <= 0 && _loc6_ > 0)
         {
            this.alertTxt2.htmlText = "温馨提示：您还可以领养<b>" + _loc6_ + "</b>只住<b>窝</b>的动物，<b>棚</b>已经住满了";
         }
         if(_loc6_ <= 0 && _loc7_ > 0)
         {
            this.alertTxt2.htmlText = "温馨提示：您还可以领养<b>" + _loc7_ + "</b>只住<b>棚</b>的动物，<b>窝</b>已经住满了";
         }
         if(_loc7_ > 0 && _loc6_ > 0)
         {
            this.alertTxt2.htmlText = "温馨提示：您还可以领养<b>" + _loc6_ + "</b>只住<b>窝</b>的动物，<b>" + _loc7_ + "</b>只住<b>棚</b>的动物";
         }
      }
      
      private function linkClick(param1:ViewEvent) : void
      {
         var _loc2_:ViewEvent = new ViewEvent(ViewEvent.LINK_CLICK);
         _loc2_.data = param1.data;
         dispatchEvent(_loc2_);
      }
   }
}

