package mc.view.main.leftInfo
{
   import cn.snowkit.containers.Pane;
   import com.qzone.corelib.js.JSProxy;
   import common.CommonData;
   import common.LocalData;
   import common.MaterialLib;
   import flash.display.MovieClip;
   import flash.display.Sprite;
   import flash.events.Event;
   import flash.events.MouseEvent;
   import flash.external.ExternalInterface;
   import flash.utils.clearTimeout;
   import flash.utils.setTimeout;
   import mc.FBridge.EventRecorder;
   import mc.FBridge.FRequest;
   import mc.control.Command;
   import mc.model.MData;
   import mc.model.MainData;
   import mc.submoudule.monthBegin.MonthBeginController;
   import mc.submoudule.monthBegin.MonthBeginModel;
   import mc.view.farm.toolBar.ToolBase;
   import mc.view.main.WindowControl.WControl;
   import mc.view.main.leftInfo.Christmaswa.ChristmaswaData;
   import mc.view.main.leftInfo.Christmaswa.ChristmaswaWindow;
   import mc.view.main.leftInfo.FlopGift.FlopGiftView;
   import mc.view.main.tip.TipControl;
   import mc.view.proxy.GameProxy;
   
   public class MyIconBar extends Sprite
   {
      
      private var monthBeginController:MonthBeginController;
      
      private var _informationIcon:InformationIcon;
      
      private var _christmaIcon:Christmaswa;
      
      private var _openTabIndex:int = 1;
      
      private var _gift:Boolean = false;
      
      private var monthBegin:MonthBeginIcon;
      
      private var _christmaswa:Boolean = false;
      
      private var beginTimer:uint;
      
      private var _postIcon:PostIcon;
      
      private var _giftIcon:GiftIcon;
      
      private var _msg:Boolean = false;
      
      private var _pane:Pane;
      
      private var fr:FRequest;
      
      private var _flopGift:FlopGiftView;
      
      private var _msgIcon:MsgIcon;
      
      private var postText:String;
      
      private var _information:Boolean = false;
      
      private var _post:Boolean = false;
      
      public function MyIconBar()
      {
         super();
         this._flopGift = new FlopGiftView();
         this._pane = new Pane(10,45);
         this._pane.align = Pane.ALIGN_LEFT;
         this._pane.vAlign = Pane.VALIGN_TOP;
         addChild(this._pane);
         this._informationIcon = new InformationIcon();
         this._informationIcon.tipText = "消息";
         this._informationIcon.addEventListener(MouseEvent.CLICK,this.informationIconClick);
         this._informationIcon.addEventListener(MouseEvent.ROLL_OVER,this.onOver);
         this._informationIcon.addEventListener(MouseEvent.MOUSE_OUT,this.onOut);
         this._informationIcon.x = 0;
         this._informationIcon.y = 4;
         this._pane.appendChild(this._informationIcon);
         this._msgIcon = new MsgIcon();
         this._msgIcon.tipText = "留言";
         this._msgIcon.addEventListener(MouseEvent.CLICK,this.msgIconClick);
         this._msgIcon.addEventListener(MouseEvent.ROLL_OVER,this.onOver);
         this._msgIcon.addEventListener(MouseEvent.MOUSE_OUT,this.onOut);
         this._msgIcon.y = 5;
         this._pane.appendChild(this._msgIcon);
         if(MonthBeginModel.gi().isGiftTime())
         {
            this.beginTimer = setTimeout(this.monthBeginFn,1000);
         }
         if(ChristmaswaData.isTime())
         {
            this.christmaswa = true;
         }
         MData.getInstance().mainData.addEventListener(MainData.GIFT_PACKAGE,this.giftPackage,false,0,true);
      }
      
      public function get msg() : Boolean
      {
         return this._msg;
      }
      
      public function set msg(param1:Boolean) : void
      {
         this._msg = param1;
         if(param1)
         {
            this._msgIcon.playIcon();
         }
         else
         {
            this._msgIcon.stopIcon();
         }
      }
      
      private function msgIconClick(param1:MouseEvent) : void
      {
         var _loc2_:Object = MData.getInstance().mainData.unreadData;
         _loc2_["a"] = 0;
         _loc2_["c"] = 0;
         MData.getInstance().mainData.unreadData = _loc2_;
         WControl.openForName("profile",this._openTabIndex);
         this._openTabIndex = 1;
      }
      
      private function monthBeginClick(param1:MouseEvent) : void
      {
         var _loc2_:MovieClip = this.getChildByName("__monthbeginarrow__") as MovieClip;
         if(_loc2_)
         {
            removeChild(_loc2_);
            _loc2_ = null;
         }
         this.monthBeginController = new MonthBeginController();
         this.monthBeginController.createBox();
      }
      
      public function set christmaswa(param1:Boolean) : void
      {
         this._christmaswa = param1;
         if(param1)
         {
            this._christmaIcon = new Christmaswa();
            this._christmaIcon.tipText = "来领奖喽！";
            this._christmaIcon.addEventListener(MouseEvent.CLICK,this.christmaClick);
            this._christmaIcon.addEventListener(MouseEvent.ROLL_OVER,this.onOver);
            this._christmaIcon.addEventListener(MouseEvent.MOUSE_OUT,this.onOut);
            this._pane.appendChild(this._christmaIcon);
         }
         else
         {
            this._pane.removeChild(this._christmaIcon);
            this._christmaIcon = null;
         }
      }
      
      public function get post() : Boolean
      {
         return this._post;
      }
      
      public function getGiftBack(param1:Object) : void
      {
         MData.getInstance().mainData.unreadData["d"] = false;
         this.gift = false;
         Command.getInstance().mainCommand.getPackageEndFn(param1);
      }
      
      private function monthBeginFn() : void
      {
         var _iniData:Object;
         var _arrow:MovieClip = null;
         clearTimeout(this.beginTimer);
         _iniData = GameProxy.iniData;
         if(this.monthBegin == null)
         {
            this.monthBegin = new MonthBeginIcon();
            if(this.monthBegin != null)
            {
               this.monthBegin.tipText = "大礼包";
               this.monthBegin.addEventListener(MouseEvent.CLICK,this.monthBeginClick);
               this.monthBegin.addEventListener(MouseEvent.ROLL_OVER,this.onOver);
               this.monthBegin.addEventListener(MouseEvent.MOUSE_OUT,this.onOut);
               this._pane.appendChild(this.monthBegin);
               if(MonthBeginModel.gi().isMonthBeginToday(MData.getInstance().mainData.host["uId"]))
               {
                  LocalData.getInstance().setObject("monthbegin_" + MData.getInstance().mainData.host["uId"],CommonData.serverTime);
                  _arrow = this.getChildByName("__monthbeginarrow__") as MovieClip;
                  if(_arrow == null)
                  {
                     _arrow = MaterialLib.getInstance().getMaterial("monthBeginArrow") as MovieClip;
                     _arrow.name = "__monthbeginarrow__";
                     if(_iniData.submodule.module.(@name == "monthbegin").@month)
                     {
                        _arrow.tipMc.tip.text = _iniData.submodule.module.(@name == "monthbegin").@month + "礼包\n火热促销中";
                     }
                     else
                     {
                        _arrow.tipMc.tip.text = "月末大礼包\n火热促销中";
                     }
                     addChild(_arrow);
                  }
                  _arrow.x = this.monthBegin.x + 35;
                  _arrow.y = this.monthBegin.y + 30;
                  _arrow.mouseEnabled = false;
                  setTimeout(function():void
                  {
                     if(_arrow)
                     {
                        if(_arrow.parent)
                        {
                           _arrow.parent.removeChild(_arrow);
                           _arrow = null;
                        }
                     }
                  },5000);
               }
            }
         }
      }
      
      private function showYellowPackage(param1:Boolean) : void
      {
         var _loc2_:String = null;
         var _loc3_:int = 0;
         var _loc4_:MainData = null;
         var _loc5_:String = null;
         var _loc6_:String = null;
         var _loc7_:String = null;
         if(ExternalInterface.available)
         {
            _loc3_ = int(CommonData.serverTime);
            _loc4_ = MData.getInstance().mainData;
            _loc5_ = CommonData.getKey();
            _loc6_ = String(_loc3_);
            _loc7_ = MainData.getKey2();
            _loc2_ = "farmKey=" + _loc5_ + "&farmTime=" + _loc6_ + "&pastureKey=" + _loc7_ + "&uIdx=" + _loc4_.getHostId;
            JSProxy.addCallBackProxy("getGiftBack",this.getGiftBack);
            if(MData.getInstance().mainData.currentUser["yellowstatus"].toString() != "0")
            {
               ExternalInterface.call("C.canvas.showYellowPackage",358,param1 == true ? false : true,_loc2_,MData.getInstance().mainData.currentUser["yellowstatus"],MData.getInstance().mainData.currentUser["yellowlevel"]);
            }
            else
            {
               ExternalInterface.call("C.canvas.showYellowPackage",358,false,_loc2_,MData.getInstance().mainData.currentUser["yellowstatus"],MData.getInstance().mainData.currentUser["yellowlevel"]);
            }
         }
      }
      
      public function get gift() : Boolean
      {
         return this._gift;
      }
      
      private function vipReturnGiftWindowConfirm() : void
      {
         MainData.vipReturnGift = false;
         MData.getInstance().mainData.VipReturnPackage = [];
         Command.getInstance().mainCommand.getVipReturnPackageEnd();
      }
      
      public function get information() : Boolean
      {
         return this._information;
      }
      
      private function giftClick(param1:MouseEvent) : void
      {
         if(MainData.isNewUser == "2")
         {
            Command.getInstance().mainCommand.getGifts();
         }
         else
         {
            this.showYellowPackage(this._gift);
         }
      }
      
      public function set post(param1:Boolean) : void
      {
         this._post = param1;
         if(param1)
         {
            if(this._postIcon == null)
            {
               this._postIcon = new PostIcon();
               this._postIcon.tipText = "公告";
               this._postIcon.y = 6;
               this._postIcon.addEventListener(MouseEvent.CLICK,this.postClick);
               this._postIcon.addEventListener(MouseEvent.ROLL_OVER,this.onOver);
               this._postIcon.addEventListener(MouseEvent.MOUSE_OUT,this.onOut);
               this._pane.appendChild(this._postIcon);
               this._postIcon.visible = false;
               this.getPostData();
            }
         }
         else if(this._postIcon != null)
         {
         }
      }
      
      private function informationIconClick(param1:MouseEvent) : void
      {
         var _loc2_:Object = MData.getInstance().mainData.unreadData;
         _loc2_["a"] = 0;
         _loc2_["c"] = 0;
         MData.getInstance().mainData.unreadData = _loc2_;
         WControl.openForName("profile",0);
      }
      
      private function postClick(param1:MouseEvent) : void
      {
         var _loc2_:PostWindow = new PostWindow();
         _loc2_.text = this.postText;
         LocalData.getInstance().setObject("postText_mc",this.postText);
         this._postIcon.stopIcon();
         WControl.open(_loc2_);
         LocalData.getInstance().setObject("postClicked",true);
      }
      
      private function getPostDataFn(param1:Object) : void
      {
         var _loc2_:String = null;
         var _loc3_:Boolean = false;
         var _loc4_:PostWindow = null;
         if(param1["code"] == 1)
         {
            if(Boolean(param1["content"] != null) && Boolean(this._postIcon) && MData.getInstance().mainData.me)
            {
               this._postIcon.visible = true;
               this.postText = param1["content"];
               _loc2_ = LocalData.getInstance().getObject("postText_mc") as String;
               _loc3_ = LocalData.getInstance().getObject("postClicked") as Boolean;
               if(_loc2_ != this.postText && this.postText != "")
               {
                  LocalData.getInstance().setObject("postClicked",false);
                  this._postIcon.playIcon();
               }
               if(!_loc3_)
               {
                  if(this._postIcon != null)
                  {
                     this._postIcon.playIcon();
                  }
               }
               if(this.postText == "")
               {
                  this._pane.removeChild(this._postIcon);
               }
            }
            Command.getInstance().mainCommand.resetUnread(param1["have_new_feeds"]);
         }
         else if(LocalData.getInstance().getObject("postText_mc"))
         {
            this.postText = LocalData.getInstance().getObject("postText_mc") as String;
         }
         else if(param1["code"] != 1)
         {
            if(Boolean(this._postIcon) && this._pane.contains(this._postIcon))
            {
               this._pane.removeChild(this._postIcon);
            }
         }
         if(this._giftIcon)
         {
            this._pane.appendChild(this._giftIcon);
         }
         if(param1["have_new_sysmsg"] == true)
         {
            this.msg = true;
            this._openTabIndex = 4;
         }
         if(param1["have_new_warnmsg"] == true)
         {
            _loc4_ = new PostWindow();
            _loc4_.text = this.postText;
            LocalData.getInstance().setObject("postText_mc",this.postText);
            WControl.open(_loc4_);
            LocalData.getInstance().setObject("postClicked",true);
            EventRecorder.recordErrorEvent(EventRecorder.CHEAT_NC,0,EventRecorder.FAULT_ERROR);
         }
         this._flopGift.init(this._pane);
      }
      
      private function onOver(param1:MouseEvent) : void
      {
         TipControl.show("MouseTip",(param1.currentTarget as ToolBase).tipText);
      }
      
      public function set information(param1:Boolean) : void
      {
         this._information = param1;
         if(param1)
         {
            this._informationIcon.playIcon();
         }
         else
         {
            this._informationIcon.stopIcon();
         }
      }
      
      public function set gift(param1:Boolean) : void
      {
         this._gift = param1;
         if(!param1)
         {
            if(this._giftIcon != null)
            {
               if(this._pane.contains(this._giftIcon))
               {
                  this._pane.removeChild(this._giftIcon);
               }
               this._giftIcon = null;
            }
            return;
         }
         if(this._giftIcon == null)
         {
            this._giftIcon = new GiftIcon();
            this._giftIcon.tipText = "礼包";
            this._giftIcon.addEventListener(MouseEvent.CLICK,this.giftClick);
            this._giftIcon.addEventListener(MouseEvent.ROLL_OVER,this.onOver);
            this._giftIcon.addEventListener(MouseEvent.MOUSE_OUT,this.onOut);
            this._pane.appendChild(this._giftIcon);
         }
         if(this._gift)
         {
            if(MData.getInstance().mainData.currentUser["yellowstatus"].toString() != "0")
            {
               this._giftIcon.playIcon();
               return;
            }
            this._giftIcon.NoVipIcon();
         }
      }
      
      public function get christmaswa() : Boolean
      {
         return this._christmaswa;
      }
      
      public function getPostData() : void
      {
         Command.getInstance().mainCommand.getNotice(this.getPostDataFn);
      }
      
      private function giftWindowConfirm() : void
      {
         var _loc1_:Object = MData.getInstance().mainData.unreadData;
         _loc1_["d"] = 0;
         MData.getInstance().mainData.unreadData = _loc1_;
         Command.getInstance().mainCommand.getPackageEnd();
      }
      
      private function onOut(param1:MouseEvent) : void
      {
         TipControl.hide();
      }
      
      private function christmaClick(param1:MouseEvent) : void
      {
         var _loc2_:ChristmaswaWindow = new ChristmaswaWindow();
         WControl.open(_loc2_);
      }
      
      private function giftPackage(param1:Event) : void
      {
         var _loc2_:GiftWindow = new GiftWindow();
         _loc2_.confirmHandler = this.giftWindowConfirm;
         _loc2_.giftData = MData.getInstance().mainData.giftPackage;
         WControl.open(_loc2_);
      }
   }
}

