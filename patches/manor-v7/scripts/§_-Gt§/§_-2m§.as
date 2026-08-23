package §_-Gt§
{
   import §_-8S§.§_-RG§;
   import §_-BT§.§_-R6§;
   import §_-R0§.§_-7S§;
   import §_-VB§.§_-1B§;
   import com.qzone.qui.containers.HBox;
   import common.Session;
   import common.§_-Ac§;
   import common.misc.Utils;
   import flash.display.MovieClip;
   import flash.events.Event;
   import flash.events.KeyboardEvent;
   import flash.events.MouseEvent;
   import flash.text.TextField;
   import framework.api.beast.BeastAPI;
   import framework.base.§_-90§;
   import report.UserActionRecorder;
   
   public class §_-2m§ extends HBox
   {
      
      public static const §_-IG§:String = "PackBtnClicked";
      
      public static const §_-64§:String = "ToolBoxBtnClicked";
      
      private static const §_-Kr§:int = 0;
      
      private static const §_-4W§:int = 1;
      
      private static const §_-aO§:int = 2;
      
      private static const §_-Kh§:int = 3;
      
      private static const §_-VF§:int = 4;
      
      private static const §_-0-§:int = 5;
      
      private static const §_-aR§:int = 6;
      
      private static const §_-5K§:int = 7;
      
      private static const §_-RU§:int = 8;
      
      private static const §_-Og§:int = 9;
      
      private static const §_-W-§:int = 10;
      
      private static const §_-3W§:int = 11;
      
      private static const §_-6W§:int = 12;
      
      private static const §_-RK§:int = 13;
      
      private const §_-0U§:Array = ["可拖动屏幕","用来收获果实(R)","一键摘取(T)","可用来翻地","在地里放害虫","我的物品包","我的工具箱","摘取好友的果实(R)","升级土地","在地里放杂草","领养、放养野生动物","捞鱼","一键捞鱼"];
      
      private var §_-4Q§:Boolean;
      
      private var §_-86§:Array;
      
      private var _API:BeastAPI;
      
      private var §_-EX§:String = "";
      
      private var m_controller:§_-1B§;
      
      private const §_-8m§:Array = ["ToolArrow","ToolHand","OneClickHand","ToolHoe","ToolInsect","ToolPack","ToolBox","ToolTheft","ToolUpgrade","ToolWeed","Tool_Wild","ToolFishNet","ToolFishNetAll"];
      
      public function §_-2m§(param1:§_-1B§)
      {
         super(518,56);
         this.m_controller = param1;
         §_-4R§ = §_-7S§.LEFT;
         §_-Wd§ = §_-7S§.§_-9o§;
         gapH = 10;
         gapV = 10;
         §_-GN§ = 7;
         §_-Tp§ = 2;
         autoLayout = true;
         verticalScrollPolicy = §_-RG§.§_-YA§;
         horizontalScrollPolicy = §_-RG§.§_-YA§;
         defaultSkin = ToolBarBg;
         this.§_-4Q§ = true;
         this.§_-86§ = new Array(§_-RK§);
         this.§_-2R§();
         addEventListener(Event.ADDED_TO_STAGE,this.onAddedToStage,false,0,true);
         this._API = BeastAPI.getInstance();
         this._API.addEventListener(EvtAPI.REWARD_CHANGE,this.onRewardChange);
         this._API.addEventListener(EvtAPI.HOST_CHANGE,this.onHostChange);
      }
      
      private function onToolRollOut(param1:MouseEvent) : void
      {
         this.m_controller.hideTip();
      }
      
      public function removeWildText() : void
      {
         var _loc1_:Tool_Wild = this.§_-86§[§_-W-§] as Tool_Wild;
         if(_loc1_ != null)
         {
            _loc1_.removeText();
         }
      }
      
      private function §_-6j§(param1:int) : *
      {
         var _loc2_:* = Utils.getMaterial(this.§_-8m§[param1]);
         if(_loc2_ == null)
         {
            return null;
         }
         _loc2_.tipText = this.§_-0U§[param1];
         _loc2_.addEventListener(MouseEvent.CLICK,this.onToolClick,false,0,true);
         _loc2_.addEventListener(MouseEvent.ROLL_OVER,this.onToolRollOver,false,0,true);
         _loc2_.addEventListener(MouseEvent.ROLL_OUT,this.onToolRollOut,false,0,true);
         addElement(_loc2_);
         return _loc2_;
      }
      
      override protected function updateBackGround() : void
      {
      }
      
      private function §_-1P§() : Tool_Wild
      {
         var _loc1_:Tool_Wild = new Tool_Wild();
         if(_loc1_ == null)
         {
            return null;
         }
         _loc1_.tipText = this.§_-0U§[§_-W-§];
         _loc1_.addEventListener(MouseEvent.MOUSE_DOWN,this.onToolClick,false,0,true);
         _loc1_.addEventListener(MouseEvent.ROLL_OVER,this.onToolRollOver,false,0,true);
         _loc1_.addEventListener(MouseEvent.ROLL_OUT,this.onToolRollOut,false,0,true);
         addElement(_loc1_);
         return _loc1_;
      }
      
      private function onKeyUp(param1:KeyboardEvent) : void
      {
         if(param1.target is TextField)
         {
            return;
         }
         switch(param1.keyCode)
         {
            case 81:
               this.setCursor(§_-Ac§.§_-Fk§);
               break;
            case 87:
               this.setCursor(§_-Ac§.§_-Mv§);
               break;
            case 69:
               this.setCursor(§_-Ac§.§_-Ve§);
               break;
            case 82:
               this.setCursor(§_-Ac§.§_-L4§);
               break;
            case 84:
               this.setCursor(§_-Ac§.§_-4J§);
         }
      }
      
      public function set myHome(param1:Boolean) : void
      {
         if(this.§_-4Q§ == param1)
         {
            return;
         }
         this.§_-4Q§ = param1;
         this.refresh();
      }
      
      private function adjustPosition() : void
      {
         this.x = (stage.stageWidth - this.width) * 0.5;
         this.y = stage.stageHeight - this.height + 1;
      }
      
      public function refresh() : void
      {
         if(this.§_-86§ == null || this.§_-86§.length == 0)
         {
            return;
         }
         removeAllElements();
         this.§_-2R§();
         Tool_Wild(this.§_-86§[§_-W-§]).§_-5Z§ = this.§_-EX§;
         var _loc1_:Boolean = Session.getInstance().§_-HR§;
         if(this.§_-4Q§ == true)
         {
            this.width = _loc1_ ? 566 : 460;
         }
         else
         {
            this.width = _loc1_ ? 518 : 416;
         }
         this.adjustPosition();
      }
      
      private function setCursor(param1:String, param2:Boolean = false) : Boolean
      {
         var _loc4_:§_-90§ = null;
         var _loc5_:§_-R6§ = null;
         var _loc3_:Boolean = false;
         if(this.m_controller != null)
         {
            _loc4_ = this.m_controller.module as §_-90§;
            if(_loc4_ != null && _loc4_.app != null)
            {
               _loc5_ = _loc4_.app.farmView.cursorCtrl;
               if(param2 == false)
               {
                  _loc5_.setCursor(param1);
                  _loc3_ = true;
               }
               else if(_loc5_.name != param1)
               {
                  _loc5_.setCursor(param1);
                  _loc3_ = true;
               }
               else
               {
                  this.setCursor(§_-Ac§.§_-7g§);
                  _loc3_ = false;
               }
            }
         }
         Session.getInstance().m_lockFishMouse = param1 == §_-Ac§.§_-AB§ || param1 == §_-Ac§.§_-Ea§;
         return _loc3_;
      }
      
      private function onAddedToStage(param1:Event) : void
      {
         removeEventListener(Event.ADDED_TO_STAGE,this.onAddedToStage);
         stage.addEventListener(KeyboardEvent.KEY_UP,this.onKeyUp,false,0,true);
         this.adjustPosition();
      }
      
      private function onToolRollOver(param1:MouseEvent) : void
      {
         if(param1.currentTarget == this.§_-86§[§_-W-§])
         {
            trace("MANOR_WILD_TOOL_OVER");
         }
         this.m_controller.showTip(§_-Ac§.§_-B0§,param1.currentTarget.tipText);
      }
      
      public function get myHome() : Boolean
      {
         return this.§_-4Q§;
      }
      
      private function onToolClick(param1:MouseEvent) : void
      {
         Session.getInstance().m_lockFishMouse = false;
         if(param1.currentTarget == this.§_-86§[§_-Kr§])
         {
            this.setCursor(§_-Ac§.§_-7g§);
         }
         else if(param1.currentTarget == this.§_-86§[§_-RU§])
         {
            this.m_controller.module.app.dispatchEvent(new Event(§_-Ac§.§_-2i§));
         }
         else if(param1.currentTarget == this.§_-86§[§_-Og§])
         {
            this.setCursor(§_-Ac§.§_-Cb§,true);
         }
         else if(param1.currentTarget == this.§_-86§[§_-VF§])
         {
            this.setCursor(§_-Ac§.§_-CA§,true);
         }
         else if(param1.currentTarget == this.§_-86§[§_-Kh§])
         {
            this.setCursor(§_-Ac§.§_-Fc§,true);
            UserActionRecorder.recordAction(UserActionRecorder.HF_TOOL_HOE_CLICKED);
         }
         else if(param1.currentTarget == this.§_-86§[§_-0-§])
         {
            this.setCursor(§_-Ac§.§_-7g§);
            dispatchEvent(new Event(§_-IG§));
            UserActionRecorder.recordAction(UserActionRecorder.HF_TOOL_PACK_CLICKED);
         }
         else if(param1.currentTarget == this.§_-86§[§_-aR§])
         {
            this.setCursor(§_-Ac§.§_-7g§);
            dispatchEvent(new Event(§_-64§));
            BeastAPI.getInstance().hideBeastPack();
            UserActionRecorder.recordAction(UserActionRecorder.HF_TOOL_TOOLBOX_CLICKED);
         }
         else if(param1.currentTarget == this.§_-86§[§_-4W§])
         {
            this.setCursor(§_-Ac§.§_-L4§,true);
            UserActionRecorder.recordAction(UserActionRecorder.HF_TOOL_HAND_CLICKED);
         }
         else if(param1.currentTarget == this.§_-86§[§_-aO§])
         {
            this.setCursor(§_-Ac§.§_-4J§,true);
            UserActionRecorder.recordAction(UserActionRecorder.HF_TOOL_ONECLICK_CLICKED);
         }
         else if(param1.currentTarget == this.§_-86§[§_-5K§])
         {
            this.setCursor(§_-Ac§.§_-L4§,true);
         }
         else if(param1.currentTarget == this.§_-86§[§_-W-§])
         {
            trace("MANOR_WILD_TOOL_DOWN");
            this.setCursor(§_-Ac§.§_-7g§);
            BeastAPI.getInstance().showBeastPack();
            UserActionRecorder.recordAction(UserActionRecorder.HF_TOOL_WILD_CLICKED);
         }
         else if(param1.currentTarget == this.§_-86§[§_-3W§])
         {
            this.setCursor(§_-Ac§.§_-AB§);
         }
         else if(param1.currentTarget == this.§_-86§[§_-6W§])
         {
            this.setCursor(§_-Ac§.§_-Ea§);
         }
         param1.stopPropagation();
      }
      
      private function onHostChange(param1:Event = null) : void
      {
         var _loc2_:Tool_Wild = this.§_-86§[§_-W-§] as Tool_Wild;
         _loc2_.§_-NT§(true,this._API.getMaterial("Icon_No") as MovieClip);
         _loc2_.§_-NT§(false);
         _loc2_.tipText = "领养、放养野生动物";
      }
      
      private function §_-NF§() : void
      {
         dispatchEvent(new Event("hidebeast"));
      }
      
      private function §_-2R§() : void
      {
         enableValidate = false;
         this.§_-86§[§_-Kr§] = this.§_-6j§(§_-Kr§);
         if(this.§_-4Q§ == true)
         {
            this.§_-86§[§_-RU§] = this.§_-6j§(§_-RU§);
            this.§_-86§[§_-Kh§] = this.§_-6j§(§_-Kh§);
            this.§_-86§[§_-0-§] = this.§_-6j§(§_-0-§);
         }
         else
         {
            this.§_-86§[§_-VF§] = this.§_-6j§(§_-VF§);
            this.§_-86§[§_-Og§] = this.§_-6j§(§_-Og§);
         }
         this.§_-86§[§_-aR§] = this.§_-6j§(§_-aR§);
         this.§_-86§[§_-W-§] = this.§_-1P§();
         if(this.§_-4Q§ == true)
         {
            this.§_-86§[§_-4W§] = this.§_-6j§(§_-4W§);
         }
         else
         {
            this.§_-86§[§_-5K§] = this.§_-6j§(§_-5K§);
         }
         this.§_-86§[§_-aO§] = this.§_-6j§(§_-aO§);
         if(Session.getInstance().§_-HR§ == true)
         {
            this.§_-86§[§_-3W§] = this.§_-6j§(§_-3W§);
            this.§_-86§[§_-6W§] = this.§_-6j§(§_-6W§);
         }
         enableValidate = true;
         validateNow();
      }
      
      private function onRewardChange(param1:EvtAPI) : void
      {
         this.§_-EX§ = param1.data as String;
         Tool_Wild(this.§_-86§[§_-W-§]).§_-5Z§ = param1.data as String;
      }
      
      override protected function setSkin() : void
      {
         if(defaultSkin != null)
         {
            _skin = new defaultSkin();
            this.addChildAt(_skin,0);
         }
      }
   }
}

