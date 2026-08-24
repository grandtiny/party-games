package mc.view.main.leftInfo.FlopGift
{
   import com.qzone.corelib.net.RSLManager;
   import common.INI;
   import common.MaterialLib;
   import flash.display.DisplayObject;
   import flash.display.Loader;
   import flash.display.MovieClip;
   import flash.display.SimpleButton;
   import flash.display.Sprite;
   import flash.events.Event;
   import flash.events.MouseEvent;
   import flash.filters.GlowFilter;
   import flash.geom.Point;
   import flash.net.URLRequest;
   import flash.net.navigateToURL;
   import flash.text.TextField;
   import flash.text.TextFieldAutoSize;
   import flash.text.TextFormat;
   import flash.text.TextFormatAlign;
   import flash.ui.Mouse;
   import flash.utils.setTimeout;
   import mc.control.Command;
   import mc.control.ViewControl;
   import mc.events.CommonEvent;
   import mc.events.WindowEvent;
   import mc.model.MData;
   import mc.model.MainData;
   import mc.view.common.BaseWindow;
   import mc.view.common.MaterialLoaderProxy;
   import mc.view.farm.GetCropID;
   import mc.view.farm.toolBar.ToolBase;
   import mc.view.main.cursor.Cursor;
   import mc.view.main.tip.TipControl;
   
   public class FlopGiftWindow extends BaseWindow
   {
      
      private var _isOk:Boolean = false;
      
      private var currentHand:Object;
      
      private var alphaSid:Array;
      
      private var _selectMc:MovieClip;
      
      private var _boxLoc:Object;
      
      private var randomIDs:Array;
      
      private var checkBox:Array;
      
      private var _theBox:MovieClip;
      
      private var loc:Point;
      
      private var dropIDAry:Array;
      
      private var _lib:MaterialLib;
      
      private var _flopData:FlopGiftData;
      
      private const _yellowURL:String = "";
      
      private var _singleMc:MovieClip;
      
      private var _cursorMc:Sprite;
      
      private var goldIDAry:Array;
      
      private var _clickTime:Array;
      
      private var _clickLocked:Boolean = false;
      
      public function FlopGiftWindow()
      {
         var i:int = 0;
         this._boxLoc = {
            "X":0,
            "Y":0
         };
         this.checkBox = [9,10,11,12];
         this.alphaSid = [16,17,18];
         this.goldIDAry = [1,2];
         this.dropIDAry = [9,10,11,12];
         this.randomIDs = new Array();
         super();
         windowName = MainData.LOGIN_FLOP_WINDOW;
         this._flopData = FlopGiftData.gi();
         this._clickTime = new Array();
         this._lib = MaterialLib.getInstance();
         this.closeVisible = false;
         this.width = 0;
         this.height = 0;
         this.mode = true;
         this._flopData.addEventListener(FlopGiftControl.FLOP_ITEM_CLICK,this.FlopItemHandler);
         this._flopData.addEventListener(FlopGiftControl.FLOP_GET_DATE,this.getFlopDateNum);
         this._flopData.addEventListener(FlopGiftControl.FLOP_CGI_GIFT,this.getFlopGiftHandler);
         this.addEventListener(MouseEvent.ROLL_OVER,function(param1:MouseEvent):void
         {
            Cursor.useSystem(true);
         });
         i = 0;
         while(i < INI.getInstance().data.flopGifts.gift.length())
         {
            this.alphaSid.push(int(INI.getInstance().data.flopGifts.gift[i].@id));
            i++;
         }
         i = 0;
         while(i < INI.getInstance().data.flopCards.gift.length())
         {
            if(INI.getInstance().data.flopCards.gift[i].@cla.substr(0,4) == "Drop")
            {
               this.dropIDAry.push(int(INI.getInstance().data.flopCards.gift[i].@sid));
            }
            i++;
         }
         this.addGiftWin();
      }
      
      private function getFlopDateNum(param1:CommonEvent) : void
      {
         var _loc2_:Object = param1.data;
         this._theBox.FlopData_txt.text = _loc2_["number"];
      }
      
      private function getFlopGiftHandler(param1:CommonEvent) : void
      {
         var flopGifts:XML = null;
         var windowEvent:WindowEvent = null;
         var e:CommonEvent = param1;
         var data:Object = e.data.data;
         flopGifts = INI.getInstance().data.flopGifts[0];
         var str:String = "";
         str = "您已连续登录" + this._flopData.flopDate + "天，牧场村委会特向您赠送" + flopGifts.gift.(@id == data["id"]).@name + flopGifts.gift.(@id == data["id"]).@num + "个，以资鼓励!";
         if(str != "")
         {
            windowEvent = new WindowEvent(WindowEvent.OPEN);
            windowEvent.windowName = "flopGift";
            windowEvent.windowArgument = {
               "sid":data["id"],
               "text":str
            };
            ViewControl.getInstance().dispatchEvent(windowEvent);
            this._flopData.flopGetGift = 0;
            this._flopData.flopTime = this._flopData.flopTime;
         }
      }
      
      private function randomID() : int
      {
         var _loc1_:int = 0;
         var _loc3_:int = 0;
         var _loc4_:Boolean = false;
         var _loc5_:int = 0;
         var _loc2_:int = int(this._flopData.clickTimeData.length);
         _loc3_ = int(INI.getInstance().data.flopCards[0].gift.length());
         while(this._isOk == false)
         {
            _loc4_ = false;
            _loc5_ = Math.ceil(Math.random() * _loc3_);
            _loc1_ = 0;
            while(_loc1_ < this.alphaSid.length)
            {
               if(_loc5_ == this.alphaSid[_loc1_])
               {
                  _loc4_ = true;
                  break;
               }
               _loc1_++;
            }
            if(!_loc4_)
            {
               _loc1_ = 0;
               while(_loc1_ < _loc2_)
               {
                  if(this._flopData.clickTimeData[_loc1_] == _loc5_)
                  {
                     _loc4_ = true;
                     break;
                  }
                  _loc1_++;
               }
               if(!_loc4_)
               {
                  _loc1_ = 0;
                  while(_loc1_ < this.randomIDs.length)
                  {
                     if(this.randomIDs[_loc1_] == _loc5_)
                     {
                        _loc4_ = true;
                        break;
                     }
                     _loc1_++;
                  }
                  if(!_loc4_)
                  {
                     this._isOk = true;
                  }
               }
            }
         }
         this._isOk = false;
         this.randomIDs.push(_loc5_);
         trace("ran:" + _loc5_);
         return _loc5_;
      }
      
      private function addGiftWin() : void
      {
         var _loc1_:Loader = new Loader();
         _loc1_.contentLoaderInfo.addEventListener(Event.COMPLETE,this.FlopWinComplete);
         trace(INI.getInstance().data.flopSWF);
         _loc1_.load(new URLRequest(GetCropID.addPrefix(String(INI.getInstance().data.flopSWF))));
      }
      
      private function BoxBtnRollOut(param1:MouseEvent) : void
      {
         this._cursorMc.stopDrag();
         removeChild(this._cursorMc);
         this._cursorMc = null;
         Mouse.show();
         param1.currentTarget.removeEventListener(MouseEvent.ROLL_OUT,this.BoxBtnRollOut);
      }
      
      private function showShopHandler(param1:MouseEvent) : void
      {
         navigateToURL(new URLRequest("http://blog.qq.com/qzone/1006666001/1312167689.htm"),"_blank");
      }
      
      private function setLocation(param1:DisplayObject, param2:TextField, param3:SimpleButton = null, param4:int = 0, param5:String = "") : void
      {
         if(param3 != null)
         {
            param1.x = this.loc.x + param3.x + param3.width / 2 - param1.width / 2;
            param1.y = this.loc.y + param3.y + param3.height / 2 - param1.height / 2;
            param2.x = this.loc.x + param3.x + param3.width - param2.width;
            param2.y = this.loc.y + param3.y + param3.height - param2.height;
         }
         else
         {
            param1.x = this.loc.x + this._boxLoc["X"] + this._theBox["Btn" + 1].width / 2 - param1.width / 2;
            param1.y = this.loc.y + this._boxLoc["Y"] + this._theBox["Btn" + 1].height / 2 - param1.height / 2;
            param2.x = this.loc.x + this._boxLoc["X"] + this._theBox["Btn" + 1].width - param2.width;
            param2.y = this.loc.y + this._boxLoc["Y"] + this._theBox["Btn" + 1].height - param2.height;
         }
         if(param5.substr(0,4) == "Drop")
         {
            param1.x += 10;
            param1.y += 10;
         }
      }
      
      private function addGiftPhoto(param1:int) : MaterialLoaderProxy
      {
         var _loc3_:DisplayObject = null;
         var _loc2_:MaterialLoaderProxy = new MaterialLoaderProxy();
         if(_loc2_.numChildren > 1)
         {
            _loc3_ = _loc2_.getChildAt(1) as DisplayObject;
            if(_loc3_ is Loader)
            {
               (_loc3_ as Loader).unload();
            }
            _loc2_.removeChild(_loc3_);
            _loc3_ = null;
         }
         _loc2_.setContent("1",param1);
         return _loc2_;
      }
      
      private function addTipWin(param1:int) : void
      {
         var flopXML:XML = null;
         var sid:String = null;
         var data:Object = null;
         var id:int = param1;
         flopXML = INI.getInstance().data.flopCards[0];
         var str:String = "";
         if(flopXML.gift.(@sid == id).@cla == "GoldCardsGame")
         {
            str = "兑换" + flopXML.gift.(@sid == id).@name + flopXML.gift.(@sid == id).@num + "个成功，已放入您的金币账号。";
            data = {};
            data["money"] = flopXML.gift.(@sid == id).@num;
            Command.getInstance().mainCommand.addMoney(data);
         }
         if(str == "")
         {
            for(sid in this.dropIDAry)
            {
               if(this.dropIDAry[sid] == id)
               {
                  str = "兑换" + flopXML.gift.(@sid == id).@name + flopXML.gift.(@sid == id).@num + "个成功，已放入您的仓库。";
                  break;
               }
            }
         }
         if(str == "")
         {
            str = "兑换" + flopXML.gift.(@sid == id).@name + flopXML.gift.(@sid == id).@num + "个成功，已放入您的牧场物品包。";
         }
         Command.getInstance().mainCommand.floatWindow(str);
      }
      
      private function BoxBtnRollOver(param1:MouseEvent) : void
      {
         this._cursorMc = MaterialLib.getInstance().getMaterial("cusor_tanabata") as Sprite;
         addChild(this._cursorMc);
         Mouse.hide();
         this._cursorMc.startDrag(true);
         param1.currentTarget.addEventListener(MouseEvent.ROLL_OUT,this.BoxBtnRollOut,false,0,true);
      }
      
      private function FlopRollOut(param1:MouseEvent) : void
      {
         TipControl.hide();
      }
      
      private function lastTimes() : void
      {
         var _loc1_:Object = MData.getInstance().mainData.host;
         if(_loc1_["yellowstatus"] != 0 && this._flopData.flopTime < FlopGiftData.YELLOW_FLOP_NUM)
         {
            this._theBox.card_txt.htmlText = "您还可以翻<font color = \'#FF6600\'> " + this._flopData.flopTime + " </font>张牌哟";
         }
         else
         {
            this._theBox.card_txt.htmlText = "VIP用户可翻<font color = \'#FF6600\'> 2 </font>张牌哟";
         }
         if(this._flopData.flopTime == 0)
         {
            this._theBox.card_txt.htmlText = "明天再来碰碰运气吧！";
         }
      }
      
      private function FlopRollOver(param1:MouseEvent) : void
      {
         TipControl.show("MouseTip",(param1.currentTarget as ToolBase).tipText);
      }
      
      private function addNoSelect(param1:SimpleButton) : void
      {
         this._singleMc = new (this._lib.getClass("single_box") as Class)();
         addChild(this._singleMc);
         this._singleMc.x = this.loc.x + param1.x;
         this._singleMc.y = this.loc.y + param1.y;
      }
      
      private function getYellowClick(param1:MouseEvent) : void
      {
      }
      
      private function FlopWinComplete(param1:Event) : void
      {
         var _loc3_:XML = null;
         var _loc4_:int = 0;
         this.currentHand = Cursor.currentCursor;
         trace(Cursor.currentCursor.toString());
         var _loc2_:Object = MData.getInstance().mainData.host;
         _loc3_ = INI.getInstance().data.flopGifts[0];
         this._lib.push(param1.currentTarget.applicationDomain);
         this._theBox = param1.target.content as MovieClip;
         this.addChildAt(this._theBox,0);
         this.loc = new Point(-this._theBox.width / 2 + this.width / 2,-this._theBox.height / 2 + this.height / 2);
         this._theBox.x = this.loc.x;
         this._theBox.y = this.loc.y;
         this._theBox.closeBtn.addEventListener(MouseEvent.CLICK,this.closeClick);
         this._theBox.FlopData_txt.text = this._flopData.flopDate;
         this.lastTimes();
         if(_loc2_["yellowstatus"] > 0)
         {
            this._theBox.getYellowBtn2.visible = false;
            this._theBox.getYellowBtn1.visible = false;
         }
         else
         {
            this._theBox.getYellowBtn2.visible = false;
            this._theBox.getYellowBtn1.visible = false;
         }
         _loc4_ = 1;
         while(_loc4_ <= 3)
         {
            this._theBox["gift" + _loc4_ + "_txt"].text = _loc3_.gift[_loc4_ - 1].@name;
            this._theBox["giftnum" + _loc4_].text = "X" + _loc3_.gift[_loc4_ - 1].@num;
            _loc4_++;
         }
         _loc4_ = 1;
         while(_loc4_ <= 9)
         {
            this._theBox["Btn" + _loc4_].addEventListener(MouseEvent.CLICK,this.BoxBtnClick,false,0,true);
            _loc4_++;
         }
         this.setCardsGift();
      }
      
      private function BoxBtnClick(param1:MouseEvent) : void
      {
         var _loc2_:SimpleButton = null;
         var _loc3_:String = null;
         if(!this._clickLocked)
         {
            _loc2_ = param1.currentTarget as SimpleButton;
            this._boxLoc = {
               "X":_loc2_.x,
               "Y":_loc2_.y
            };
            this._clickLocked = true;
            _loc3_ = _loc2_.name;
            this._clickTime.push({
               "mc":_loc2_,
               "vid":int(_loc3_.substr(3,_loc3_.length))
            });
            this._flopData.flopItemClick();
            param1.target.mouseEnabled = false;
         }
      }
      
      private function closeClick(param1:MouseEvent) : void
      {
         Cursor.setCursor("CursorArrow");
         var _loc2_:MData = MData.getInstance();
         _loc2_.farmData.reloadUserSeed = true;
         _loc2_.mainData.reloadUserCrop = true;
         this.removeAll();
         this.closeHandler();
      }
      
      private function addGift(param1:int, param2:SimpleButton = null) : void
      {
         var getMc:Function;
         var topBox:ToolBase = null;
         var iniData:XML = null;
         var _material:DisplayObject = null;
         var numTxt:TextField = null;
         var _url:String = null;
         var item:String = null;
         var id:int = param1;
         var box:SimpleButton = param2;
         topBox = new ToolBase();
         iniData = INI.getInstance().data.flopCards[0];
         for(item in iniData.gift)
         {
            if(iniData.gift[item].@sid == id)
            {
               if(this._clickTime.length != 0)
               {
                  this._clickTime[this._clickTime.length - 1].sid = id;
               }
               if(iniData.gift[item].@cla == "")
               {
                  _material = this.addGiftPhoto(int(iniData.gift[item].@vid));
               }
               else if(iniData.gift[item].@swf == "")
               {
                  _material = this._lib.getMaterial(iniData.gift[item].@cla) as MovieClip;
                  if(_material == null)
                  {
                     _material = new (this._lib.getClass(iniData.gift[item].@cla) as Class)();
                     if(iniData.gift[item].@cla == "Crop_40_Seed")
                     {
                        _material.scaleX = _material.scaleY = 0.6;
                     }
                  }
               }
               else
               {
                  getMc = function():void
                  {
                     _material = _lib.getMaterial(iniData.gift[item].@cla) as MovieClip;
                     topBox.addChild(_material);
                     topBox.tipText = overTxt(box,iniData.gift[item]);
                     addChild(topBox);
                     numTxt = addText(iniData.gift[item].@num);
                     addChild(numTxt);
                     setTimeout(function():void
                     {
                        if(_material)
                        {
                           _material.width = 65;
                           _material.height = 60;
                        }
                        setLocation(topBox,numTxt,box,iniData.gift[item].@sid,iniData.gift[item].@cla);
                     },10);
                  };
                  _url = GetCropID.addPrefix(iniData.gift[item].@swf);
                  RSLManager.getInstance().requestClass(iniData.gift[item].@cla,getMc,_url);
               }
               break;
            }
         }
         if(_material)
         {
            topBox.addChild(_material);
            topBox.tipText = this.overTxt(box,iniData.gift[item]);
            addChild(topBox);
            numTxt = this.addText(iniData.gift[item].@num);
            addChild(numTxt);
            this.setLocation(topBox,numTxt,box,iniData.gift[item].@sid,iniData.gift[item].@cla);
         }
         topBox.buttonMode = true;
         topBox.addEventListener(MouseEvent.ROLL_OVER,this.FlopRollOver,false,0,true);
         topBox.addEventListener(MouseEvent.ROLL_OUT,this.FlopRollOut,false,0,true);
      }
      
      private function addSelectMc() : void
      {
         this._selectMc = new (this._lib.getClass("select_box") as Class)();
         addChild(this._selectMc);
         this._selectMc.x = this.loc.x + this._boxLoc["X"];
         this._selectMc.y = this.loc.y + this._boxLoc["Y"];
      }
      
      private function addText(param1:int) : TextField
      {
         var _loc2_:TextField = new TextField();
         _loc2_.text = "x" + param1;
         _loc2_.selectable = false;
         _loc2_.autoSize = TextFieldAutoSize.RIGHT;
         _loc2_.setTextFormat(new TextFormat("Verdana",20,6710886,null,null,null,null,null,TextFormatAlign.RIGHT));
         _loc2_.filters = [new GlowFilter(16777215,1,2,2,10,1,false,false)];
         return _loc2_;
      }
      
      private function FlopItemHandler(param1:CommonEvent) : void
      {
         var _loc3_:int = 0;
         var _loc4_:int = 0;
         var _loc5_:int = 0;
         var _loc6_:Boolean = false;
         this._clickLocked = false;
         var _loc2_:Object = param1.data.data;
         if(int(_loc2_["code"]) == 1)
         {
            this._flopData.flopTime = int(_loc2_["canNum"]);
            this.addSelectMc();
            this.addGift(_loc2_["id"]);
            this._flopData.clickTimeData.push(_loc2_["id"]);
            this.addTipWin(_loc2_["id"]);
            this.lastTimes();
            if(_loc2_["canNum"] == 0)
            {
               _loc5_ = int(this._clickTime.length);
               this.randomIDs.splice(0);
               _loc3_ = 1;
               while(_loc3_ <= 9)
               {
                  _loc6_ = true;
                  _loc4_ = 0;
                  while(_loc4_ < _loc5_)
                  {
                     if(_loc3_ == this._clickTime[_loc4_]["vid"])
                     {
                        _loc6_ = false;
                        break;
                     }
                     _loc4_++;
                  }
                  if(_loc6_)
                  {
                     this.addNoSelect(this._theBox["Btn" + _loc3_]);
                     this.addGift(this.randomID(),this._theBox["Btn" + _loc3_]);
                     this._theBox["Btn" + _loc3_].mouseEnabled = false;
                  }
                  _loc3_++;
               }
            }
         }
         else
         {
            if(_loc2_.hasOwnProperty("direction"))
            {
               Command.getInstance().mainCommand.floatWindow(_loc2_["direction"]);
               return;
            }
            Command.getInstance().mainCommand.floatWindow("系统繁忙，请稍后再试");
         }
      }
      
      private function setCardsGift() : void
      {
         var _loc1_:XML = null;
         _loc1_ = INI.getInstance().data.flopGifts[0];
         if(this._flopData.flopDate == int(_loc1_.gift[0].@days))
         {
            this._flopData.flopLoginGift(this._flopData.flopDate);
         }
         else if(this._flopData.flopDate == int(_loc1_.gift[1].@days))
         {
            this._flopData.flopLoginGift(this._flopData.flopDate);
         }
         else if(this._flopData.flopDate >= int(_loc1_.gift[2].@days))
         {
            this._flopData.flopLoginGift(this._flopData.flopDate);
         }
      }
      
      private function overTxt(param1:SimpleButton, param2:XML) : String
      {
         var _loc3_:String = null;
         var _loc4_:String = null;
         if(param1 == null)
         {
            _loc3_ = "";
            if(param2.@cla == "GoldCardsGame")
            {
               _loc3_ = param2.@num + param2.@per + param2.@name + ",已放入您的金币账号";
            }
            if(_loc3_ == "")
            {
               for(_loc4_ in this.dropIDAry)
               {
                  if(this.dropIDAry[_loc4_] == param2.@sid)
                  {
                     _loc3_ = param2.@num + param2.@per + param2.@name + ",已放入您的仓库。";
                     break;
                  }
               }
            }
            if(_loc3_ == "")
            {
               _loc3_ = param2.@num + param2.@per + param2.@name + ",已放入您的牧场物品包。";
            }
            return _loc3_;
         }
         return param2.@num + param2.@per + param2.@name + ",继续努力，明天再来试试吧！";
      }
      
      private function addAnimal(param1:Object) : void
      {
         var _loc4_:String = null;
         var _loc2_:Sprite = this._lib.getMaterial("Animal_" + param1["_type"] + "_6") as Sprite;
         if(!_loc2_)
         {
            _loc4_ = GetCropID.getAnimalURL(param1["_type"],6);
            RSLManager.getInstance().requestClass("Animal_" + param1["_type"] + "_6",this.addAnimal,_loc4_,{
               "_mc":param1["_mc"],
               "_type":param1["_type"]
            });
            return;
         }
         if(param1["_mc"].getChildByName("__dataLoading__"))
         {
            param1["_mc"].removeChild(param1["_mc"].getChildByName("__dataLoading__"));
         }
         var _loc3_:MovieClip = _loc2_.getChildAt(_loc2_.numChildren - 1) as MovieClip;
         _loc3_.x = 20;
         _loc3_.y = _loc3_.height / 2;
         param1["_mc"].addChild(_loc3_);
      }
   }
}

